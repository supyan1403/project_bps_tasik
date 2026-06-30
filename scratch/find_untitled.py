import psycopg2

conn = psycopg2.connect("postgresql://postgres.staovyakhojystdyxbjf:bpskabtasik@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres")
cursor = conn.cursor()

# Query all tables in the DB
cursor.execute("SELECT document_id, table_name, csv_path FROM extracted_tables")
rows = cursor.fetchall()

print("=== ALL UNTITLED TABLES (No dash '-' in name) ===")
count = 0
for row in rows:
    doc_id, table_name, csv_path = row
    if '-' not in table_name and 'Tabel' in table_name:
        print(f"Doc ID: {doc_id} | Name: {table_name}")
        count += 1
print(f"Total untitled: {count}")
