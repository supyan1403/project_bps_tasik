import os
import sys
sys.path.insert(0, os.path.abspath("."))

from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.staovyakhojystdyxbjf:bpskabtasik@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    rows = conn.execute(text("SELECT id, data FROM table_rows WHERE table_id = 4672 ORDER BY id")).fetchall()
    print(f"Total rows in DB: {len(rows)}")
    for r in rows:
        print(r[0], r[1])
