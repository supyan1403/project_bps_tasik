import sqlite3

db_path = r"D:\Kuliah\KP\project_bps_tasik\backend\bps_dashboard.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Find the document ID for 2025
cursor.execute("SELECT id, filename FROM documents WHERE filename LIKE '%2025%'")
docs = cursor.fetchall()
print(f"2025 Documents: {docs}")

for doc_id, filename in docs:
    print(f"\nTables for Document ID {doc_id}:")
    cursor.execute("SELECT id, table_name FROM extracted_tables WHERE document_id = ?", (doc_id,))
    tables = cursor.fetchall()
    for tid, tname in tables:
        # Print table names that might be related to Bab 1 or Bab 11 (e.g. starting with "1.3" or "1.4" or "11")
        if tname.startswith("Tabel 1.3") or tname.startswith("Tabel 1.4") or tname.startswith("Tabel_1.3") or tname.startswith("Tabel_1.4") or "11" in tname:
            print(f"  ID {tid}: {tname}")

conn.close()
