import sys
sys.path.insert(0, '.')
sys.path.insert(0, 'D:\\Kuliah\\KP\\project_bps_tasik')
from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Verify
r = db.execute(text('SELECT COUNT(*) FROM table_rows WHERE numeric_value IS NOT NULL')).scalar()
r2 = db.execute(text('SELECT COUNT(*) FROM table_rows')).scalar()
print(f'Rows with numeric_value: {r}/{r2}')

# Find large values (potential truncation)
print('\n--- Rows with numeric_value > 100000 ---')
rows = db.execute(text('''
    SELECT tr.id, tr.numeric_value, tr.value_column, et.table_name, et.document_id
    FROM table_rows tr
    JOIN extracted_tables et ON tr.table_id = et.id
    WHERE tr.numeric_value > 100000
    ORDER BY tr.numeric_value DESC
    LIMIT 15
''')).fetchall()
for r in rows:
    print(f'  id={r[0]} val={r[1]:,.1f} col="{r[2][:30]}" table={r[3][:40]} doc={r[4]}')

# Check table 7562 (Ayam Kampung) now
print('\n--- Table 7562 (Ayam Kampung) Bantarkalong ---')
r = db.execute(text('''
    SELECT tr.data, tr.numeric_value, tr.value_column
    FROM table_rows tr WHERE tr.table_id = 7562 AND tr.data LIKE :l
'''), {'l': '%Bantarkalong%'}).fetchone()
import json
d = json.loads(r[0])
print(f'  Ayam Kampung: {d.get("Produksi Daging Ayam Kampung")}')
print(f'  numeric_value: {r[1]} (column: {r[2]})')

db.close()
