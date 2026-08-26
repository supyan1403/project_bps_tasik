import sys, json, time
sys.path.insert(0, '.')
sys.path.insert(0, 'D:\\Kuliah\\KP\\project_bps_tasik')
from database import SessionLocal
from sqlalchemy import text
from pipeline_utils import parse_indonesian_number

db = SessionLocal()
rows = db.execute(text('SELECT id, data FROM table_rows')).fetchall()
t0 = time.time()
upd = 0
batch = []

for r in rows:
    d = json.loads(r.data)
    # Find first numeric value and its column name
    for k, v in d.items():
        n = parse_indonesian_number(str(v).strip())
        if n is not None:
            batch.append({'id': r.id, 'nv': n, 'vc': k})
            break
    else:
        batch.append({'id': r.id, 'nv': None, 'vc': None})

    if len(batch) >= 1000:
        for b in batch:
            db.execute(text('UPDATE table_rows SET numeric_value=:nv, value_column=:vc WHERE id=:id'), b)
        db.commit()
        upd += len(batch)
        batch = []

if batch:
    for b in batch:
        db.execute(text('UPDATE table_rows SET numeric_value=:nv, value_column=:vc WHERE id=:id'), b)
    db.commit()
    upd += len(batch)

elapsed = time.time() - t0
db.close()
print(f'Populated {upd} rows in {elapsed:.1f}s')
