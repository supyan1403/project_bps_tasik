import sqlite3

db_path = r"D:\Kuliah\KP\project_bps_tasik\backend\bps_dashboard.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Search for tables containing "Sarana Perdagangan" or "Pasar Tradisional"
cursor.execute("SELECT document_id, table_name FROM extracted_tables WHERE table_name LIKE '%Sarana Perdagangan%' OR table_name LIKE '%Pasar Tradisional%'")
rows = cursor.fetchall()

print("Matching tables in DB:")
for r in rows:
    print(r)

conn.close()
