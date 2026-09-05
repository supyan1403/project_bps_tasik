import psycopg2
import re
import json
import sys

print("Menghubungkan ke Supabase PostgreSQL...")
pg_uri = "postgresql://postgres.uxtmjfbndtjgzshuffcq:bpskabtasik@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
try:
    pg_con = psycopg2.connect(pg_uri)
    pg_cur = pg_con.cursor()
    print("Berhasil tersambung ke Supabase!")
except Exception as e:
    print(f"Gagal koneksi ke Supabase: {e}")
    sys.exit(1)

sql_file = r"d:\Kuliah\KP\project_bps_tasik\backups\bps_bps_tasikmalaya_20260904_184607.sql"
print(f"Membaca file dump: {sql_file}")

with open(sql_file, "r", encoding="utf-8", errors="ignore") as f:
    sql_text = f.read()

# 1. Migrate documents
print("\n[1/4] Migrasi documents...")
doc_matches = re.findall(r"INSERT INTO `documents` VALUES\s*(.*?);", sql_text, re.DOTALL)
if doc_matches:
    raw_vals = doc_matches[0].strip()
    # Format: (id, 'filename', year, 'status', 'created_at')
    tuples = re.findall(r"\((\d+),'([^']*)',(\d+),'([^']*)','([^']*)'\)", raw_vals)
    for t in tuples:
        doc_id, fn, yr, st, ca = t
        pg_cur.execute(
            'INSERT INTO "documents" (id, filename, year, status, created_at) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING',
            (int(doc_id), fn, int(yr), st, ca)
        )
    pg_con.commit()
    print(f"-> Selesai ({len(tuples)} documents).")

# 2. Migrate extracted_tables
print("\n[2/4] Migrasi extracted_tables...")
table_matches = re.findall(r"INSERT INTO `extracted_tables` VALUES\s*(.*?);", sql_text, re.DOTALL)
count_et = 0
for match in table_matches:
    # Pattern: (id, doc_id, 'table_name', 'csv_path', 'headers', 'units', 'years')
    # Using python parser for MySQL row tuples
    lines = match.strip().split("),(")
    for line in lines:
        cleaned = line.strip("();\n\r ")
        # Tokenize by comma respecting quotes
        parts = []
        cur_p = []
        in_q = False
        esc = False
        for c in cleaned:
            if c == "'" and not esc:
                in_q = not in_q
            elif c == "\\" and not esc:
                esc = True
                cur_p.append(c)
                continue
            elif c == "," and not in_q:
                parts.append("".join(cur_p).strip())
                cur_p = []
                esc = False
                continue
            cur_p.append(c)
            esc = False
        if cur_p:
            parts.append("".join(cur_p).strip())
            
        if len(parts) >= 7:
            et_id = int(parts[0])
            doc_id = int(parts[1]) if parts[1] != 'NULL' else None
            t_name = parts[2].strip("'").encode('utf-8').decode('unicode_escape', 'ignore')
            c_path = parts[3].strip("'").encode('utf-8').decode('unicode_escape', 'ignore')
            headers = parts[4].strip("'").encode('utf-8').decode('unicode_escape', 'ignore')
            units = parts[5].strip("'").encode('utf-8').decode('unicode_escape', 'ignore')
            years = parts[6].strip("'").encode('utf-8').decode('unicode_escape', 'ignore')
            
            try:
                pg_cur.execute(
                    'INSERT INTO "extracted_tables" (id, document_id, table_name, csv_path, headers, units, years) VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING',
                    (et_id, doc_id, t_name, c_path, headers, units, years)
                )
                count_et += 1
            except Exception as e:
                pass
pg_con.commit()
print(f"-> Selesai ({count_et} extracted_tables).")

# 3. Migrate table_rows using json file for 100% precision
print("\n[3/4] Migrasi table_rows dari JSON backup...")
json_file = r"d:\Kuliah\KP\project_bps_tasik\backups\table_rows_backup_20260827_001656.json"
with open(json_file, "r", encoding="utf-8") as f:
    rows = json.load(f)

print(f"Ditemukan {len(rows)} baris data...")
batch = []
for r in rows:
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
print(f"-> Selesai ({len(rows)} table_rows).")

# 4. Migrate system_config & sync sequence
print("\n[4/4] Sinkronisasi Sequence ID...")
for tbl in ['documents', 'extracted_tables', 'table_rows']:
    try:
        pg_cur.execute(f"SELECT setval(pg_get_serial_sequence('\"{tbl}\"', 'id'), coalesce((SELECT max(id) FROM \"{tbl}\"), 1));")
        pg_con.commit()
    except Exception as e:
        print(f"Sequence warning: {e}")

print("\n==========================================")
print("SELURUH DATA BERHASIL DI-MIGRASI KE SUPABASE!")
print("==========================================")

pg_con.close()
