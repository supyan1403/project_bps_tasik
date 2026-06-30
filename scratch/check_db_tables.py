import sqlite3

db_path = r"D:\Kuliah\KP\project_bps_tasik\backend\bps_dashboard.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, filename, year, status FROM documents")
rows = cursor.fetchall()
print("All Documents in Database:")
for r in rows:
    print(r)

print("\nLast 5 Extracted Tables:")
cursor.execute("SELECT id, document_id, table_name, csv_path FROM extracted_tables ORDER BY id DESC LIMIT 5")
for r in cursor.fetchall():
    print(r)

conn.close()
