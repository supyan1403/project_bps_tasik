import sys, json, re
sys.path.insert(0, '.')
sys.path.insert(0, 'D:\\Kuliah\\KP\\project_bps_tasik')
from database import SessionLocal
from sqlalchemy import text
from pipeline_utils import parse_indonesian_number
import importlib, main
importlib.reload(main)
from main import _format_scaled_indo_number

def scale_down(raw):
    n = parse_indonesian_number(str(raw).strip())
    if n is None:
        return raw
    scaled = n / 1000.0
    return _format_scaled_indo_number(scaled)

db = SessionLocal()
total_updated = 0

# 1. Fix "Produksi Daging Ayam Kampung" in table 7562 (doc 92)
print("=== Fix 1: Produksi Daging Ayam Kampung (table 7562) ===")
t = db.execute(text('SELECT id, headers FROM extracted_tables WHERE id=7562')).fetchone()
headers = json.loads(t.headers)
target_cols = [h for h in headers if 'daging ayam kampung' in h.lower() and 'petelur' not in h.lower() and 'pedaging' not in h.lower()]
print(f"Target columns: {target_cols}")
rows = db.execute(text('SELECT id, data FROM table_rows WHERE table_id=7562')).fetchall()
upd = 0
for r in rows:
    d = json.loads(r.data)
    changed = False
    for col in target_cols:
        old = d.get(col, '')
        new = scale_down(old)
        if new != old:
            d[col] = new
            changed = True
            upd += 1
    if changed:
        db.execute(text('UPDATE table_rows SET data=:d WHERE id=:id'),
                   {'d': json.dumps(d, ensure_ascii=False), 'id': r.id})
print(f"Updated {upd} values in table 7562")

# 2. Fix "Jumlah Penduduk Miskin" in doc 92
print("\n=== Fix 2: Jumlah Penduduk Miskin (doc 92) ===")
# Find all doc 92 tables with "jumlah penduduk miskin" column
tables = db.execute(text(
    "SELECT id, table_name, headers FROM extracted_tables WHERE document_id=92"
)).fetchall()
fix2_total = 0
for t in tables:
    headers = json.loads(t.headers) if t.headers else []
    miskin_cols = [h for h in headers if 'jumlah penduduk miskin' in h.lower()]
    if not miskin_cols:
        continue
    rows = db.execute(text('SELECT id, data FROM table_rows WHERE table_id=:tid'), {'tid': t.id}).fetchall()
    upd = 0
    for r in rows:
        d = json.loads(r.data)
        changed = False
        for col in miskin_cols:
            old = d.get(col, '')
            n = parse_indonesian_number(str(old).strip())
            if n is not None and n > 0 and n < 10000:  # likely truncated (< 10k when should be >100k)
                new = scale_down(old)
                if new != old:
                    d[col] = new
                    changed = True
                    upd += 1
        if changed:
            db.execute(text('UPDATE table_rows SET data=:d WHERE id=:id'),
                       {'d': json.dumps(d, ensure_ascii=False), 'id': r.id})
    if upd > 0:
        print(f"  table {t.id} ({t.table_name[:50]}): {upd} values, cols={miskin_cols}")
        fix2_total += upd
print(f"Total Fix 2: {fix2_total} values")

# 3. Compare doc 92 vs doc 87 for all shared tables to find remaining 1000x issues
print("\n=== Scan: Remaining 1000x issues doc 92 vs doc 87 ===")
import statistics
doc87_tables = {}
for t in db.execute(text("SELECT id, table_name, headers FROM extracted_tables WHERE document_id=87")).fetchall():
    key = re.sub(r'\b(19|20)\d{2}\b', '', re.sub(r'\([^)]*\)', '', re.sub(r'^Tabel\s+[\d.]+\s*-?\s*', '', t.table_name, flags=re.IGNORECASE))).strip().lower()
    doc87_tables[key] = t

for t in tables:
    headers = json.loads(t.headers) if t.headers else []
    if len(headers) < 2:
        continue
    key = re.sub(r'\b(19|20)\d{2}\b', '', re.sub(r'\([^)]*\)', '', re.sub(r'^Tabel\s+[\d.]+\s*-?\s*', '', t.table_name, flags=re.IGNORECASE))).strip().lower()
    if key not in doc87_tables:
        continue
    t87 = doc87_tables[key]
    h87 = json.loads(t87.headers)
    # Match columns by normalized name
    for h92 in headers[1:]:
        nh = re.sub(r'[^a-z0-9 ]', '', h92.lower()).strip()
        matching87 = [h for h in h87[1:] if re.sub(r'[^a-z0-9 ]', '', h.lower()).strip() == nh]
        if not matching87:
            continue
        h87_match = matching87[0]
        rows92 = db.execute(text('SELECT data FROM table_rows WHERE table_id=:tid'), {'tid': t.id}).fetchall()
        rows87 = db.execute(text('SELECT data FROM table_rows WHERE table_id=:tid'), {'tid': t87.id}).fetchall()
        v92 = [parse_indonesian_number(str(json.loads(r.data).get(h92, '')).strip()) for r in rows92]
        v87 = [parse_indonesian_number(str(json.loads(r.data).get(h87_match, '')).strip()) for r in rows87]
        v92 = [x for x in v92 if x is not None and x > 0]
        v87 = [x for x in v87 if x is not None and x > 0]
        if len(v92) < 3 or len(v87) < 3:
            continue
        m92 = statistics.median(v92)
        m87 = statistics.median(v87)
        if m87 > 0:
            ratio = m92 / m87
            if 700 <= ratio <= 1500:
                print(f"  1000x LARGE: table {t.id} col '{h92[:40]}' | doc92_med={m92:.1f} doc87_med={m87:.1f} ratio={ratio:.1f}")
            elif 0.00067 <= ratio <= 0.00143:
                print(f"  1000x SMALL: table {t.id} col '{h92[:40]}' | doc92_med={m92:.1f} doc87_med={m87:.1f} ratio={ratio:.4f}")

db.commit()
db.close()
print(f"\n=== DONE. Total updated: {total_updated + fix2_total} ===")
