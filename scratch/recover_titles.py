"""Try to recover full titles from PDF or TOC data."""
import os, sys, re
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))
import models
from database import SessionLocal

db = SessionLocal()

# Get all truncated titles for doc 85
tables = db.query(models.ExtractedTable).filter(
    models.ExtractedTable.document_id == 85
).order_by(models.ExtractedTable.id).all()

# Find the longest CSV filename for each table to try to reconstruct
for t in tables:
    name = t.table_name or ''
    csv = t.csv_path or ''
    csv_fn = os.path.basename(csv) if csv else ''
    
    # Check if title seems truncated (ends in partial word)
    # A title with `, 2025` or `, 2024` is complete
    has_year_suffix = bool(re.search(r',\s*\d{4}\s*$', name))
    
    if not has_year_suffix:
        print(f'=== id={t.id} MISSING YEAR ===')
        print(f'  Name: {name}')
        print(f'  CSV:  {csv_fn}')
        print()

db.close()
