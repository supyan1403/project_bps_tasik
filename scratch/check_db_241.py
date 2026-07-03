import os
import json
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.staovyakhojystdyxbjf:bpskabtasik@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    row = conn.execute(text("SELECT id, table_name, csv_path FROM extracted_tables WHERE document_id = 58 AND table_name LIKE 'Tabel 2.4.1%'")).fetchone()
    if row:
        print(f"Table Found: ID={row[0]}, Name={row[1]}, CSV={row[2]}")
        rows = conn.execute(text(f"SELECT data FROM table_rows WHERE table_id = {row[0]} ORDER BY id")).fetchall()
        for r in rows:
            print(r[0])
    else:
        print("Table 2.4.1 not found in database for 2025.")
