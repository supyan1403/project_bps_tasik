import sqlite3

db_path = r"D:\Kuliah\KP\project_bps_tasik\backend\bps_dashboard.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, filename, year, status FROM documents")
docs = cursor.fetchall()
print("All Documents:")
for d in docs:
    print(d)

conn.close()
