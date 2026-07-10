"""Check CSV filenames for full titles."""
import os, sys, re
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))
import models
from database import SessionLocal

db = SessionLocal()

# Check truncated titles
tables = db.query(models.ExtractedTable).filter(models.ExtractedTable.document_id == 85).order_by(models.ExtractedTable.id).all()

for t in tables:
    name = t.table_name or ''
    csv = t.csv_path or ''
    csv_filename = os.path.splitext(os.path.basename(csv))[0] if csv else ''
    # Check if CSV filename has longer title
    if csv_filename and len(csv_filename) > len(name.replace(', 2025','').replace(', 2024','')):
        clean_name = name.replace(', 2025','').replace(', 2024','')
        print(f'DB:  {clean_name}')
        print(f'CSV: {csv_filename}')
        print()

db.close()
