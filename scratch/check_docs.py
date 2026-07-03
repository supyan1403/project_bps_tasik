import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from database import SessionLocal
import models

db = SessionLocal()
try:
    docs = db.query(models.Document).all()
    print("=== DOCUMENTS ===")
    for d in docs:
        print(f"ID: {d.id} | Filename: {d.filename} | Year: {d.year} | Status: {d.status}")
        tables = db.query(models.ExtractedTable).filter_by(document_id=d.id).all()
        print(f"  Total Tables: {len(tables)}")
        for t in tables[:5]:
            print(f"    Table ID: {t.id} | Name: {t.table_name} | CSV Path: {t.csv_path}")
        if len(tables) > 5:
            print("    ...")
finally:
    db.close()
