import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Database URL from environment or fallback to database.py default
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.staovyakhojystdyxbjf:bpskabtasik@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

# Check documents
from sqlalchemy import text
print("--- Documents ---")
docs = db.execute(text("SELECT id, filename, year, status FROM documents")).fetchall()
for doc in docs:
    print(doc)

print("\n--- Tables for 2024 Document ---")
# Find 2024 doc id
doc_2024 = db.execute(text("SELECT id FROM documents WHERE year = 2024")).fetchone()
if doc_2024:
    doc_id = doc_2024[0]
    tables = db.execute(text(f"SELECT id, table_name, csv_path FROM extracted_tables WHERE document_id = {doc_id}")).fetchall()
    for t in tables:
        print(f"ID: {t[0]}, Name: {t[1]}")
else:
    print("No document for year 2024 found.")

db.close()
