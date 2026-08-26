import sys, os, json, datetime
sys.path.insert(0, '.')
from database import SessionLocal
from sqlalchemy import text

backup_dir = os.path.join(os.path.dirname(os.path.abspath('.')), 'backups')
# fall back to project backups dir
backup_dir = r'D:\Kuliah\KP\project_bps_tasik\backups'
os.makedirs(backup_dir, exist_ok=True)

ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
out = os.path.join(backup_dir, f'table_rows_backup_{ts}.json')

db = SessionLocal()
rows = db.execute(text('SELECT id, table_id, sort_order, data FROM table_rows')).fetchall()
data = [{'id': r.id, 'table_id': r.table_id, 'sort_order': r.sort_order, 'data': r.data} for r in rows]
db.close()

with open(out, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)

print(f'Backed up {len(data)} rows to {out}')
print(f'Size: {os.path.getsize(out) / 1024:.1f} KB')
