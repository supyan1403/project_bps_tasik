import sys, os, json
sys.path.insert(0, '.')
from database import SessionLocal
from sqlalchemy import text

backup_path = r'D:\Kuliah\KP\project_bps_tasik\backups\table_rows_backup_20260826_211836.json'
data = json.load(open(backup_path, encoding='utf-8'))

db = SessionLocal()
upd = 0
for row in data:
    db.execute(text('UPDATE table_rows SET data=:d, sort_order=:s WHERE id=:id'),
               {'d': row['data'], 's': row['sort_order'], 'id': row['id']})
    upd += 1
    if upd % 1000 == 0:
        db.commit()
db.commit()
db.close()
print(f'Restored {upd} rows from backup.')
