import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from database import SessionLocal
import models

db = SessionLocal()
try:
    tables = db.query(models.ExtractedTable).filter_by(document_id=57).all()
    print(f"Total tables for doc 57 in DB: {len(tables)}")
    for t in tables:
        if "Tabel 6" in t.table_name or "Tabel_6" in t.table_name:
            print(f"  ID: {t.id} | Name: {t.table_name}")
finally:
    db.close()
