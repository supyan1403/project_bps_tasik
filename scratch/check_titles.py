"""Check all table titles for completeness."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))
import models
from database import SessionLocal

db = SessionLocal()
tables = db.query(models.ExtractedTable).order_by(models.ExtractedTable.id).all()

print(f"Total tables: {len(tables)}")
print()

# Group by document
by_doc = {}
for t in tables:
    by_doc.setdefault(t.document_id, []).append(t)

for doc_id, tbls in by_doc.items():
    print(f"\n=== Document {doc_id} ===")
    for t in tbls:
        name = t.table_name or '(empty)'
        # Check if title looks truncated
        truncated = False
        # Ends with year pattern like (2025), (2024)?
        import re
        has_year = bool(re.search(r'\(\d{4}\)', name))
        # Ends with "..." or trailing dash
        ends_cut = name.rstrip().endswith(('...', '..', '-', '–'))
        print(f'  id={t.id:5d} year_ok={has_year} cut={ends_cut} | {name[:150]}')

db.close()
