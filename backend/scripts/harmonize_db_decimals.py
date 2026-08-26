import sys, json, re
sys.path.insert(0, '.')
sys.path.insert(0, 'backend')
from database import SessionLocal
from sqlalchemy import text
from pipeline_utils import parse_indonesian_number

db = SessionLocal()

print("================================================================================")
print("HARMONISASI DATA DESIMAL DATABASE SECARA LANGSUNG (TANPA RE-EKSTRAKSI)")
print("================================================================================")

total_rows_updated = 0

def format_indo_decimal(val_float, decimals=2):
    fmt = f"{{:.{decimals}f}}".format(val_float)
    return fmt.replace('.', ',')

try:
    # -------------------------------------------------------------------------
    # 1. Tabel 5.4.4 (Table 7154, Doc 91) - Produksi Daging Ayam Kampung
    # -------------------------------------------------------------------------
    print("\n[1] Menyelaraskan Tabel 7154: Produksi Daging Ternak Unggas (Doc 91)...")
    rows_7154 = db.execute(text("SELECT id, data, value_column FROM table_rows WHERE table_id=7154")).fetchall()
    upd_7154 = 0
    for r in rows_7154:
        d = json.loads(r.data)
        changed = False
        
        for col in ["Produksi Daging Ayam Kampung", "Produksi Daging Ayam Kampung.1"]:
            if col in d:
                raw_val = str(d[col]).strip()
                n = parse_indonesian_number(raw_val)
                if n is not None and n > 1000:
                    scaled = n / 1000.0
                    new_str = format_indo_decimal(scaled, 2)
                    d[col] = new_str
                    changed = True
                    
        if changed:
            val_col = r.value_column
            num_val = None
            if val_col and val_col in d:
                num_val = parse_indonesian_number(str(d[val_col]))
            elif "Produksi Daging Ayam Kampung" in d:
                num_val = parse_indonesian_number(str(d["Produksi Daging Ayam Kampung"]))
                
            db.execute(text("""
                UPDATE table_rows 
                SET data = :d, numeric_value = :nv 
                WHERE id = :id
            """), {
                "d": json.dumps(d, ensure_ascii=False),
                "nv": num_val,
                "id": r.id
            })
            upd_7154 += 1
            
    print(f"  -> Berhasil memperbarui {upd_7154} baris di Tabel 7154.")
    total_rows_updated += upd_7154

    # -------------------------------------------------------------------------
    # 2. Tabel 4.4.1 (Table 7126, Doc 91) - Jumlah Penduduk Miskin
    # -------------------------------------------------------------------------
    print("\n[2] Menyelaraskan Tabel 7126: Garis & Jumlah Penduduk Miskin (Doc 91)...")
    rows_7126 = db.execute(text("SELECT id, data, value_column FROM table_rows WHERE table_id=7126")).fetchall()
    upd_7126 = 0
    for r in rows_7126:
        d = json.loads(r.data)
        changed = False
        
        miskin_cols = [k for k in d.keys() if "jumlah penduduk miskin" in k.lower()]
        for col in miskin_cols:
            raw_val = str(d[col]).strip()
            n = parse_indonesian_number(raw_val)
            if n is not None and n > 10000:
                scaled = n / 1000.0
                if abs(scaled - round(scaled, 1)) < 0.001:
                    new_str = f"{scaled:.1f}".replace('.', ',')
                else:
                    new_str = f"{scaled:.2f}".replace('.', ',')
                d[col] = new_str
                changed = True
                
        if changed:
            val_col = r.value_column
            num_val = None
            if val_col and val_col in d:
                num_val = parse_indonesian_number(str(d[val_col]))
            db.execute(text("""
                UPDATE table_rows 
                SET data = :d, numeric_value = :nv 
                WHERE id = :id
            """), {
                "d": json.dumps(d, ensure_ascii=False),
                "nv": num_val,
                "id": r.id
            })
            upd_7126 += 1
            
    print(f"  -> Berhasil memperbarui {upd_7126} baris di Tabel 7126.")
    total_rows_updated += upd_7126

    # -------------------------------------------------------------------------
    # 3. Panjang Jalan (Table 7177 Doc 91, Table 6832 Doc 87, Table 7585 Doc 92)
    # -------------------------------------------------------------------------
    print("\n[3] Menyelaraskan Panjang Jalan Menurut Kondisi (Tabel 7177, 6832, 7585)...")
    for tid in [7177, 6832, 7585]:
        rows_jalan = db.execute(text("SELECT id, data, value_column FROM table_rows WHERE table_id=:tid"), {"tid": tid}).fetchall()
        upd_jalan = 0
        for r in rows_jalan:
            d = json.loads(r.data)
            kondisi = str(d.get("Kondisi Jalan", "")).lower()
            if "kabupaten" in kondisi or "total" in kondisi or "jumlah" in kondisi:
                continue
                
            changed = False
            for k, v in d.items():
                if "panjang jalan" in k.lower():
                    v_str = str(v).strip()
                    n = parse_indonesian_number(v_str)
                    if n is not None and n > 5000:
                        scaled = n / 1000.0
                        new_str = f"{scaled:.2f}".replace('.', ',')
                        d[k] = new_str
                        changed = True
                        
            if changed:
                val_col = r.value_column
                num_val = None
                if val_col and val_col in d:
                    num_val = parse_indonesian_number(str(d[val_col]))
                db.execute(text("""
                    UPDATE table_rows 
                    SET data = :d, numeric_value = :nv 
                    WHERE id = :id
                """), {
                    "d": json.dumps(d, ensure_ascii=False),
                    "nv": num_val,
                    "id": r.id
                })
                upd_jalan += 1
        print(f"  -> Berhasil memperbarui {upd_jalan} baris di Tabel {tid}.")
        total_rows_updated += upd_jalan

    # -------------------------------------------------------------------------
    # 4. Susu Sapi Perah (Tabel 7155 Doc 91 & Tabel 6810 Doc 87)
    # -------------------------------------------------------------------------
    print("\n[4] Menyelaraskan Susu Sapi Perah (Tabel 7155 & 6810)...")
    for tid in [7155, 6810]:
        rows_susu = db.execute(text("SELECT id, data, value_column FROM table_rows WHERE table_id=:tid"), {"tid": tid}).fetchall()
        upd_susu = 0
        for r in rows_susu:
            d = json.loads(r.data)
            changed = False
            kec = str(d.get("Kecamatan", "")).strip().lower()
            if not kec or "kabupaten" in kec or "total" in kec:
                continue
                
            for col in ["Produksi Susu Sapi Perah", "Produksi Susu Sapi Perah.1"]:
                if col in d:
                    raw_val = str(d[col]).strip()
                    n = parse_indonesian_number(raw_val)
                    if n is not None and 1000 <= n <= 200000:
                        scaled = n / 1000.0
                        new_str = f"{scaled:.2f}".replace('.', ',')
                        d[col] = new_str
                        changed = True
                        
            if changed:
                val_col = r.value_column
                num_val = None
                if val_col and val_col in d:
                    num_val = parse_indonesian_number(str(d[val_col]))
                db.execute(text("""
                    UPDATE table_rows 
                    SET data = :d, numeric_value = :nv 
                    WHERE id = :id
                """), {
                    "d": json.dumps(d, ensure_ascii=False),
                    "nv": num_val,
                    "id": r.id
                })
                upd_susu += 1
        print(f"  -> Berhasil memperbarui {upd_susu} baris di Tabel {tid}.")
        total_rows_updated += upd_susu

    # Commit semua perubahan
    db.commit()
    print(f"\n================================================================================")
    print(f"SUKSES: Total {total_rows_updated} baris berhasil diupdate secara presisi di DB!")
    print(f"================================================================================")

except Exception as e:
    db.rollback()
    print(f"ERROR: Terjadi kesalahan saat update database: {e}")
    raise e
finally:
    db.close()
