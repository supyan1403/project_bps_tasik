"""
Script Pemulihan & Perbaikan Satuan Database Supabase SIPEDAS
Menggunakan data baseline bersih dari: backend/backup_units_before_patch.json
Kebijakan:
1. TIDAK menggunakan karakter superscript '²' (gunakan ASCII standar: Km2, Jiwa/Km2, m2)
2. Menggunakan Exact Dictionary Mapping (TIDAK ADA replace string kosong/liar)
3. Memperbaiki Tabel 3.1.1 secara presisi (Persentase -> %, Kepadatan -> Jiwa/Km2, Rasio JK -> -)
4. Membersihkan placeholder 'satuan' dan 'tahun' pada kolom pertama entitas
"""

import json
import os
import psycopg2
from psycopg2.extras import Json

DB_URI = "postgresql://postgres.uxtmjfbndtjgzshuffcq:bpskabtasik@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Kamus Pemetaan Eksak untuk normalisasi satuan tanpa superscript
EXACT_UNIT_MAP = {
    # Varian Km2 / Jiwa per Km2
    "Jiwa/Km²": "Jiwa/Km2",
    "Jiwa/KmÂ²": "Jiwa/Km2",
    "Jiwa/Km": "Jiwa/Km2",
    "Jiwa/Km": "Jiwa/Km2",
    "Jiwa/Km2": "Jiwa/Km2",
    "jiwa/km2": "Jiwa/Km2",
    "jiwa/km²": "Jiwa/Km2",
    
    # Varian Km2
    "Km²": "Km2",
    "KmÂ²": "Km2",
    "Km": "Km2",
    "Km": "Km2",
    "Km2": "Km2",
    "km2": "Km2",
    "km²": "Km2",
    
    # Varian m2
    "m2/ m2": "m2",
    "m²": "m2",
    "mÂ²": "m2",
    "m": "m2",
    "m2": "m2",
    
    # Varian m3
    "m3": "m3",
    
    # Casing & Standarisasi umum
    "satuan": "-",
    "persen": "%",
    "persentase": "%",
    "percent": "%",
    "jiwa": "Jiwa",
    "ton": "Ton",
    "kuintal": "Kuintal",
}

def clean_single_unit(u: str) -> str:
    if u is None:
        return ""
    u_clean = str(u).strip()
    return EXACT_UNIT_MAP.get(u_clean, u_clean)

def clean_single_year(y: str) -> str:
    if y is None:
        return ""
    y_clean = str(y).strip()
    if y_clean.lower() == "tahun":
        return "-"
    return y_clean

def run_recovery_patch(dry_run: bool = False):
    backup_file = os.path.join(os.path.dirname(__file__), "backup_units_before_patch.json")
    if not os.path.exists(backup_file):
        raise FileNotFoundError(f"File backup tidak ditemukan: {backup_file}")
        
    print(f"--- Membaca data baseline dari: {backup_file} ---")
    with open(backup_file, "r", encoding="utf-8") as f:
        baseline_data = json.load(f)
    print(f"Total tabel di baseline backup: {len(baseline_data)}")
    
    print(f"--- Menghubungkan ke Database Supabase (dry_run={dry_run}) ---")
    con = psycopg2.connect(DB_URI)
    cur = con.cursor()
    
    t311_ids = [6585, 6620, 7095, 7213, 7512]
    updated_count = 0
    
    for item in baseline_data:
        t_id = item["id"]
        t_name = item.get("table_name", "")
        raw_units = item.get("units")
        raw_years = item.get("years")
        
        if not raw_units:
            continue
            
        new_units = [clean_single_unit(u) for u in raw_units]
        new_years = [clean_single_year(y) for y in (raw_years if raw_years else [""] * len(raw_units))]
        
        # 1. Perlakuan Khusus untuk Tabel 3.1.1
        if t_id in t311_ids or ("3.1.1" in t_name and "Penduduk" in t_name):
            if len(new_units) >= 6:
                new_units[0] = "-"
                new_units[1] = "Jiwa"
                new_units[2] = "%"
                new_units[3] = "%"
                new_units[4] = "Jiwa/Km2"  # ASCII murni, tidak ada superscript
                new_units[5] = "-"
                
            if len(new_years) >= 1 and str(new_years[0]).lower() in ["tahun", ""]:
                new_years[0] = "-"
            print(f"[3.1.1 FIX] ID {t_id} -> {new_units}")
        else:
            # 2. Tabel umum: pastikan kolom 0 satuan & tahun bersih
            if len(new_units) > 0 and new_units[0] == "satuan":
                new_units[0] = "-"
            if len(new_years) > 0 and new_years[0] == "tahun":
                new_years[0] = "-"
                
        if not dry_run:
            cur.execute(
                "UPDATE extracted_tables SET units = %s, years = %s WHERE id = %s;",
                (Json(new_units), Json(new_years), t_id)
            )
        updated_count += 1
        
    if not dry_run:
        con.commit()
        print(f"\n[SUKSES] Berhasil me-restore & memperbarui {updated_count} tabel di Supabase!")
    else:
        print(f"\n[DRY RUN] {updated_count} tabel akan dipulihkan & diperbarui.")
        
    con.close()

if __name__ == "__main__":
    import sys
    dry = "--dry-run" in sys.argv
    run_recovery_patch(dry_run=dry)
