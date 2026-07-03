import os
import sys
sys.path.insert(0, os.path.abspath("."))

from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.staovyakhojystdyxbjf:bpskabtasik@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    row = conn.execute(text("SELECT id, table_name, csv_path FROM extracted_tables WHERE document_id = 58 AND table_name LIKE 'Tabel 2.3.3%'")).fetchone()
    if row:
        print(f"Table 2.3.3 in 2025: ID={row[0]}, Name={row[1]}, CSV={row[2]}")
    else:
        print("Table 2.3.3 not found in database for 2025.")
