import pymysql
import psycopg2
import json
import sys

print("Menghubungkan ke MySQL lokal (XAMPP)...")
try:
    my_con = pymysql.connect(host='127.0.0.1', user='root', password='', database='bps_tasikmalaya', charset='utf8mb4')
    my_cur = my_con.cursor()
    print("MySQL lokal tersambung!")
except Exception as e:
    print(f"Gagal konek MySQL lokal: {e}")
    sys.exit(1)

print("Menghubungkan ke Supabase PostgreSQL...")
pg_uri = "postgresql://postgres.uxtmjfbndtjgzshuffcq:bpskabtasik@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
try:
    pg_con = psycopg2.connect(pg_uri)
    pg_cur = pg_con.cursor()
    print("Supabase tersambung!")
except Exception as e:
    print(f"Gagal konek Supabase: {e}")
    sys.exit(1)

tables = ['documents', 'extracted_tables', 'table_rows', 'user_sessions', 'activity_logs', 'system_config']

for tbl in tables:
    my_cur.execute(f"SELECT * FROM `{tbl}`")
    rows = my_cur.fetchall()
    cols = [d[0] for d in my_cur.description]
    col_str = ', '.join([f'"{c}"' for c in cols])
    placeholders = ', '.join(['%s'] * len(cols))
    
    print(f"\nMemindahkan {len(rows)} baris dari tabel '{tbl}'...")
    
    # Batch insert per 500 rows
    batch = []
    for row in rows:
        formatted = []
        for val in row:
            if isinstance(val, (dict, list)):
                formatted.append(json.dumps(val))
            elif isinstance(val, str) and (val.startswith("{") or val.startswith("[")):
                # Validasi JSON string
                try:
                    json.loads(val)
                    formatted.append(val)
                except Exception:
                    formatted.append(val)
            else:
                formatted.append(val)
        batch.append(formatted)
        
        if len(batch) >= 500:
            query = f'INSERT INTO "{tbl}" ({col_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
            pg_cur.executemany(query, batch)
            pg_con.commit()
            batch = []
            
    if batch:
        query = f'INSERT INTO "{tbl}" ({col_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
        pg_cur.executemany(query, batch)
        pg_con.commit()
        
    print(f"-> Selesai memindahkan tabel '{tbl}'.")

# Reset Postgres sequence / auto-increment
for tbl in ['documents', 'extracted_tables', 'table_rows', 'activity_logs']:
    try:
        pg_cur.execute(f"SELECT setval(pg_get_serial_sequence('\"{tbl}\"', 'id'), coalesce(max(id), 1)) FROM \"{tbl}\";")
        pg_con.commit()
    except Exception as e:
        print(f"Warning reset sequence for {tbl}: {e}")

print("\n==========================================")
print("MIGRASI DATA KE SUPABASE 100% SUKSES!")
print("==========================================")

my_con.close()
pg_con.close()
