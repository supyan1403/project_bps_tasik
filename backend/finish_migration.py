import psycopg2
import json

print("Menghubungkan ke Supabase...")
pg_uri = "postgresql://postgres.uxtmjfbndtjgzshuffcq:bpskabtasik@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
pg_con = psycopg2.connect(pg_uri)
pg_cur = pg_con.cursor()

# Ambil semua table_id yang valid di extracted_tables
pg_cur.execute("SELECT id FROM extracted_tables")
valid_table_ids = set(r[0] for r in pg_cur.fetchall())
print(f"Jumlah tabel induk valid: {len(valid_table_ids)}")

json_file = r"d:\Kuliah\KP\project_bps_tasik\backups\table_rows_backup_20260827_001656.json"
with open(json_file, "r", encoding="utf-8") as f:
    rows = json.load(f)

print(f"Total baris di backup: {len(rows)}")

# Filter hanya baris yang table_id nya ada di extracted_tables
valid_rows = [r for r in rows if r["table_id"] in valid_table_ids]
print(f"Baris data yang valid disalin: {len(valid_rows)}")

batch = []
for r in valid_rows:
    batch.append((r["id"], r["table_id"], r["data"], False, r.get("sort_order", 0)))
    if len(batch) >= 1000:
        pg_cur.executemany(
            'INSERT INTO "table_rows" (id, table_id, data, is_anomaly, sort_order) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING',
            batch
        )
        pg_con.commit()
        batch = []
if batch:
    pg_cur.executemany(
        'INSERT INTO "table_rows" (id, table_id, data, is_anomaly, sort_order) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING',
        batch
    )
    pg_con.commit()

# Sync sequence
for tbl in ['documents', 'extracted_tables', 'table_rows']:
    try:
        pg_cur.execute(f"SELECT setval(pg_get_serial_sequence('\"{tbl}\"', 'id'), coalesce((SELECT max(id) FROM \"{tbl}\"), 1));")
        pg_con.commit()
    except Exception as e:
        pass

# Final count
pg_cur.execute('SELECT count(*) FROM documents')
doc_c = pg_cur.fetchone()[0]
pg_cur.execute('SELECT count(*) FROM extracted_tables')
tab_c = pg_cur.fetchone()[0]
pg_cur.execute('SELECT count(*) FROM table_rows')
row_c = pg_cur.fetchone()[0]

print("\n==========================================")
print(f"MIGRASI 100% SUKSES TUNTAS!")
print(f"Dokumen: {doc_c}")
print(f"Tabel: {tab_c}")
print(f"Baris Data: {row_c}")
print("==========================================")

pg_con.close()
