"""Generate Master Data from reference document (doc 85 / publikasi 2026)."""
import os, sys, json, re
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))
import models
from database import SessionLocal

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
MASTER_FILE = os.path.join(OUTPUT_DIR, "master_indicators.json")
COLUMNS_FILE = os.path.join(OUTPUT_DIR, "master_columns.json")

db = SessionLocal()

# Get all tables from doc 85
tables = db.query(models.ExtractedTable).filter(
    models.ExtractedTable.document_id == 85
).all()

print(f"Found {len(tables)} tables in doc 85")

# Collect all column headers and first-column values
all_headers = {}   # header_lower -> {standard, count, tables[]}
all_indicators = {}  # indicator_raw -> {standard, is_reference, tables[]}

# Also read CSV files for unit/year data
import csv as csv_lib

for t in tables:
    name = t.table_name or ''
    
    # CSV headers
    if t.csv_path and os.path.exists(t.csv_path):
        try:
            with open(t.csv_path, 'r', encoding='utf-8', errors='replace') as f:
                reader = csv_lib.reader(f)
                raw_rows = [row for row in reader]
        except:
            continue
        if not raw_rows:
            continue
        headers = raw_rows[0]
        for h in headers:
            h_stripped = h.strip()
            if not h_stripped:
                continue
            key = h_stripped.lower()
            if key not in all_headers:
                all_headers[key] = {"standard": h_stripped, "count": 0, "tables": []}
            all_headers[key]["count"] += 1
            if t.id not in all_headers[key]["tables"]:
                all_headers[key]["tables"].append(t.id)
    
    # DB data - first column values
    rows = db.query(models.TableRow).filter(
        models.TableRow.table_id == t.id
    ).order_by(models.TableRow.id).all()
    
    if rows:
        first_record = rows[0].data if isinstance(rows[0].data, dict) else {}
        entity_keys = list(first_record.keys())
        if entity_keys:
            entity_key = entity_keys[0]
            for r in rows:
                data = r.data if isinstance(r.data, dict) else {}
                val = str(data.get(entity_key, '')).strip()
                if val and val not in ['-', '...', ''] and not val.replace('.','').replace(',','').isdigit():
                    key = val.lower().strip()
                    if key not in all_indicators:
                        all_indicators[key] = {"standard": val, "is_reference": False, "tables": []}
                    all_indicators[key]["count"] = all_indicators.get(key, {}).get("count", 0) + 1
                    if t.id not in all_indicators[key]["tables"]:
                        all_indicators[key]["tables"].append(t.id)

# Sort by frequency
sorted_headers = sorted(all_headers.values(), key=lambda x: -x["count"])
sorted_indicators = sorted(all_indicators.values(), key=lambda x: -x.get("count", 0))

# Save headers
headers_out = [{"standard": h["standard"], "count": h["count"], "tables": len(h["tables"])} for h in sorted_headers]
with open(COLUMNS_FILE, 'w', encoding='utf-8') as f:
    json.dump({"columns": headers_out, "total_columns": len(headers_out)}, f, indent=2, ensure_ascii=False)
print(f"Saved {len(headers_out)} master columns to {COLUMNS_FILE}")

# Save indicators
indicators_out = [{"standard": ind.get("standard", ""), "count": ind.get("count", 0), "tables": len(ind.get("tables", []))} for ind in sorted_indicators]
with open(MASTER_FILE, 'w', encoding='utf-8') as f:
    json.dump({"indicators": indicators_out, "total_indicators": len(indicators_out)}, f, indent=2, ensure_ascii=False)
print(f"Saved {len(indicators_out)} master indicators to {MASTER_FILE}")

# Print top ones
print(f"\nTop 10 most common headers:")
for h in sorted_headers[:10]:
    print(f"  [{h['count']}x] {h['standard'][:80]}")

print(f"\nTop 10 most common indicators:")
for ind in sorted_indicators[:10]:
    print(f"  [{ind.get('count',0)}x] {ind.get('standard','?')}")

db.close()
print("\nDone!")
