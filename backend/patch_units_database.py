"""
Script untuk membersihkan encoding mojibake dan kesalahan satuan (units) di database Supabase SIPEDAS.
Mencakup:
1. Backup otomatis seluruh data units & years sebelum diubah
2. Perbaikan khusus Tabel 3.1.1 (Persentase Penduduk -> %, Kepadatan -> Jiwa/Km², Rasio JK -> -)
3. Pembersihan global karakter Â², , m2/ m2, dll di seluruh tabel
4. Pembersihan placeholder 'satuan' dan 'tahun' pada kolom pertama (Rincian/Kecamatan)
"""

import json
import os
import psycopg2
from psycopg2.extras import Json

DB_URI = "postgresql://postgres.uxtmjfbndtjgzshuffcq:bpskabtasik@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

def clean_unit_string(u: str) -> str:
    if not u:
        return ""
    
    # Trim
    u = str(u).strip()
    
    # 1. Bersihkan mojibake Â² atau replacement character 
    u = u.replace("Â²", "²").replace("", "²")
    
    # 2. Standarisasi Jiwa/Km², Km², m²
    if u in ["Jiwa/KmÂ²", "Jiwa/Km", "Jiwa/Km2", "jiwa/km2", "jiwa/km²"]:
        return "Jiwa/Km²"
    if u in ["KmÂ²", "Km", "Km2", "km2", "km²"]:
        return "Km²"
    if u in ["m2/ m2", "m2", "mÂ²", "m"]:
        return "m²"
    
    # 3. Normalisasi umum
    if u.lower() == "satuan":
        return "-"
    if u.lower() in ["persen", "persentase", "percent"]:
        return "%"
    if u == "jiwa":
        return "Jiwa"
    if u == "ton":
        return "Ton"
    if u == "kuintal":
        return "Kuintal"
        
    return u

def clean_year_string(y: str) -> str:
    if not y:
        return ""
    y = str(y).strip()
    if y.lower() == "tahun":
        return "-"
    return y

def run_patch(dry_run: bool = False):
    print(f"--- Menghubungkan ke Database Supabase (dry_run={dry_run}) ---")
    con = psycopg2.connect(DB_URI)
    cur = con.cursor()
    
    # Ambil semua tabel
    cur.execute("SELECT id, table_name, headers, units, years FROM extracted_tables ORDER BY id;")
    all_tables = cur.fetchall()
    print(f"Total tabel di database: {len(all_tables)}")
    
    # 1. Buat backup snapshot
    backup_file = os.path.join(os.path.dirname(__file__), "backup_units_before_patch.json")
    backup_data = []
    for r in all_tables:
        backup_data.append({
            "id": r[0],
            "table_name": r[1],
            "units": r[3],
            "years": r[4]
        })
    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2)
    print(f"[OK] Backup snapshot berhasil disimpan di: {backup_file}")
    
    # 2. Proses pembersihan
    modified_count = 0
    t311_ids = [6585, 6620, 7095, 7213, 7512]
    
    for t_id, t_name, headers, units, years in all_tables:
        if not units:
            continue
            
        orig_units = list(units)
        orig_years = list(years) if years else [""] * len(orig_units)
        new_units = list(orig_units)
        new_years = list(orig_years)
        is_changed = False
        
        # A. Perlakuan Khusus untuk Tabel 3.1.1 (Jumlah, Laju, Persentase, Kepadatan, Rasio JK)
        if t_id in t311_ids or ("3.1.1" in t_name and "Penduduk" in t_name):
            # Target Tabel 3.1.1:
            # Col 0: Kecamatan -> Satuan '-', Tahun '-'
            # Col 1: Jumlah Penduduk -> 'Jiwa'
            # Col 2: Laju Pertumbuhan -> '%'
            # Col 3: Persentase Penduduk -> '%'
            # Col 4: Kepadatan Penduduk -> 'Jiwa/Km²'
            # Col 5: Rasio Jenis Kelamin -> '-'
            if len(new_units) >= 6:
                new_units[0] = "-"
                new_units[1] = "Jiwa"
                new_units[2] = "%"
                new_units[3] = "%"
                new_units[4] = "Jiwa/Km²"
                new_units[5] = "-"
                
                if len(new_years) >= 1 and new_years[0].lower() == "tahun":
                    new_years[0] = "-"
                is_changed = True
                print(f"[3.1.1 FIX] Tabel ID {t_id}: '{t_name[:60]}...' diperbarui satuannya.")
        else:
            # B. Pembersihan Global untuk tabel lainnya
            for i in range(len(new_units)):
                cleaned_u = clean_unit_string(new_units[i])
                if cleaned_u != new_units[i]:
                    new_units[i] = cleaned_u
                    is_changed = True
                    
            for i in range(len(new_years)):
                cleaned_y = clean_year_string(new_years[i])
                if cleaned_y != new_years[i]:
                    new_years[i] = cleaned_y
                    is_changed = True
                    
            # Khusus kolom 0: jika bertuliskan 'satuan', jadikan '-'
            if len(new_units) > 0 and new_units[0] == "satuan":
                new_units[0] = "-"
                is_changed = True
            if len(new_years) > 0 and new_years[0] == "tahun":
                new_years[0] = "-"
                is_changed = True
                
        if is_changed:
            modified_count += 1
            if not dry_run:
                cur.execute(
                    "UPDATE extracted_tables SET units = %s, years = %s WHERE id = %s;",
                    (Json(new_units), Json(new_years), t_id)
                )
    
    if not dry_run:
        con.commit()
        print(f"\n[SUKSES] Berhasil memperbarui {modified_count} tabel di database Supabase!")
    else:
        print(f"\n[DRY RUN] {modified_count} tabel akan diperbarui (belum di-commit).")
        
    con.close()

if __name__ == "__main__":
    import sys
    dry = "--dry-run" in sys.argv
    run_patch(dry_run=dry)
