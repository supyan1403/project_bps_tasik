import os
import pdfplumber
from sqlalchemy import create_engine, text

# 1. Cari document_id untuk tahun 2025
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.staovyakhojystdyxbjf:bpskabtasik@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres")
engine = create_engine(DATABASE_URL)

doc_id = None
with engine.connect() as conn:
    row = conn.execute(text("SELECT id, filename FROM documents WHERE year = 2025")).fetchone()
    if row:
        doc_id = row[0]
        filename = row[1]
        print(f"Document 2025: ID={doc_id}, Filename={filename}")
        
        # Cari Tabel 1.1.2
        t_row = conn.execute(text("SELECT id, table_name, csv_path FROM extracted_tables WHERE document_id = :doc_id AND table_name LIKE 'Tabel 1.1.2%'"), {"doc_id": doc_id}).fetchone()
        if t_row:
            table_id, table_name, csv_path = t_row
            print(f"Tabel 1.1.2 di DB: ID={table_id}, Name={table_name}, CSV={csv_path}")
        else:
            print("Tabel 1.1.2 belum diekstrak/tidak ditemukan di DB.")
            
# 2. Cari halaman fisik Tabel 1.1.2 di 2025 PDF
# Biasanya kita baca toc.json jika ada
toc_path = f"backend/hasil_ekstraksi_web/doc_{doc_id}/toc.json"
if os.path.exists(toc_path):
    import json
    with open(toc_path, 'r', encoding='utf-8') as f:
        toc_data = json.load(f)
        for item in toc_data:
            if "1.1.2" in item.get("name", ""):
                print(f"TOC Match: {item}")
