import sys, json, re
sys.path.insert(0, '.')
sys.path.insert(0, 'backend')
from database import SessionLocal
from sqlalchemy import text
from pipeline_utils import parse_indonesian_number

db = SessionLocal()

print("================================================================================")
print("PEMBERSIHAN EDGE CASES DATABASE (TYPO OCR, SYMBOL BERSIH, & NUMERIC_VALUE)")
print("================================================================================")

try:
    # 1. Fix double dot in row 125424 (Table 7561)
    r_dot = db.execute(text("SELECT id, data FROM table_rows WHERE id=125424")).fetchone()
    if r_dot:
        d = json.loads(r_dot.data)
        if d.get("Produksi Daging Sapi Potong") == "12..82":
            d["Produksi Daging Sapi Potong"] = "12,82"
            db.execute(text("UPDATE table_rows SET data=:d WHERE id=:id"), {
                "d": json.dumps(d, ensure_ascii=False), "id": r_dot.id
            })
            print("1. Fixed row 125424 (12..82 -> 12,82)")

    # 2. Fix ",," and ",,,," in PDRB tables (7596, 7597, 7598, 7599) -> '-'
    rows_comma = db.execute(text("SELECT id, data FROM table_rows WHERE data LIKE '%,,%'")).fetchall()
    cnt_comma = 0
    for r in rows_comma:
        d = json.loads(r.data)
        changed = False
        for k, v in d.items():
            if isinstance(v, str) and re.match(r'^,+$', v.strip()):
                d[k] = "-"
                changed = True
        if changed:
            db.execute(text("UPDATE table_rows SET data=:d WHERE id=:id"), {
                "d": json.dumps(d, ensure_ascii=False), "id": r.id
            })
            cnt_comma += 1
    print(f"2. Fixed {cnt_comma} rows with double/multiple comma artifacts -> '-'")

    # 3. Fix Table 6592 (value_column and numeric_value)
    rows_6592 = db.execute(text("SELECT id, data FROM table_rows WHERE table_id=6592")).fetchall()
    for r in rows_6592:
        d = json.loads(r.data)
        col_name = "Persentase Penduduk Berumur 15 Tahun ke Atas yang Melek Huruf"
        if col_name in d:
            val_num = parse_indonesian_number(str(d[col_name]))
            db.execute(text("""
                UPDATE table_rows 
                SET value_column = :vc, numeric_value = :nv 
                WHERE id = :id
            """), {
                "vc": col_name, "nv": val_num, "id": r.id
            })
    print("3. Fixed Table 6592 value_column & numeric_value (Persentase Melek Huruf)")

    # 4. Fix duplicate headers in Table 6600 (Doc 85)
    t6600 = db.execute(text("SELECT id, headers FROM extracted_tables WHERE id=6600")).fetchone()
    if t6600 and t6600.headers:
        hl = json.loads(t6600.headers)
        from pipeline_utils import deduplicate_columns
        new_headers = deduplicate_columns(hl)
        db.execute(text("UPDATE extracted_tables SET headers=:h WHERE id=6600"), {
            "h": json.dumps(new_headers, ensure_ascii=False)
        })
        print("4. Fixed Table 6600 duplicate headers with deduplication suffix")

    db.commit()
    print("\nSUKSES: Semua edge cases berhasil dibersihkan!")

except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
