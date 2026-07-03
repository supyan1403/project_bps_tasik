import os
import shutil
import csv
import json
from sqlalchemy import create_engine, text

# 1. Salin CSV hasil ekstraksi terbaru tahun 2025 ke folder web
src_dir = r"d:\Kuliah\KP\project_bps_tasik\outputs\Ekstraksi_Hal_76_sd_78"
dst_dir = r"d:\Kuliah\KP\project_bps_tasik\backend\hasil_ekstraksi_web\doc_58\Ekstraksi_Hal_57_sd_78"

os.makedirs(dst_dir, exist_ok=True)

csv_file = None
for f in os.listdir(src_dir):
    if f.startswith("Tabel 2.4.1") and f.endswith(".csv"):
        csv_file = f
        break

if csv_file:
    src_path = os.path.join(src_dir, csv_file)
    dst_file = csv_file
    for f in os.listdir(dst_dir):
        if f.startswith("Tabel 2.4.1") and f.endswith(".csv"):
            dst_file = f
            break
            
    dst_path = os.path.join(dst_dir, dst_file)
    shutil.copy2(src_path, dst_path)
    print(f"Berhasil menyalin:\n  Dari: {src_path}\n  Ke: {dst_path}")
    
    # 2. Update Database secara langsung menggunakan SQLAlchemy
    DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.staovyakhojystdyxbjf:bpskabtasik@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Cari Table ID
        row = conn.execute(text("SELECT id FROM extracted_tables WHERE document_id = 58 AND table_name LIKE 'Tabel 2.4.1%'")).fetchone()
        if row:
            table_id = row[0]
            print(f"Table ID: {table_id}")
            
            # Hapus data lama di table_rows
            conn.execute(text(f"DELETE FROM table_rows WHERE table_id = {table_id}"))
            print("Data lama di table_rows dihapus.")
            
            # Parse CSV
            raw_rows = []
            with open(dst_path, 'r', encoding='utf-8', errors='replace') as f:
                reader = csv.reader(f)
                for csv_row in reader:
                    raw_rows.append(csv_row)
                    
            if raw_rows:
                headers = raw_rows[0]
                has_metadata = False
                if len(raw_rows) >= 3:
                    col0_row1 = str(raw_rows[1][0]).strip().lower() if len(raw_rows[1]) > 0 else ""
                    col0_row2 = str(raw_rows[2][0]).strip().lower() if len(raw_rows[2]) > 0 else ""
                    if col0_row1 == "satuan" or col0_row2 == "tahun":
                        has_metadata = True
                        
                data_rows = raw_rows[3:] if has_metadata else raw_rows[1:]
                
                records = []
                for r in data_rows:
                    record = {}
                    for idx, h in enumerate(headers):
                        val = r[idx] if idx < len(r) else ""
                        record[h] = val
                    records.append(record)
                
                # Insert data baru
                for rec in records:
                    is_anomaly = False
                    for val in rec.values():
                        if str(val).strip() in ["", "-", "?", ""]:
                            is_anomaly = True
                            break
                    
                    rec_json = json.dumps(rec)
                    query = text("INSERT INTO table_rows (table_id, data, is_anomaly) VALUES (:table_id, :data, :is_anomaly)")
                    conn.execute(query, {"table_id": table_id, "data": rec_json, "is_anomaly": is_anomaly})
            
            # Commit transaksi
            conn.commit()
            print(f"Pemuatan ulang selesai! Berhasil menyimpan {len(records)} baris data ke database.")
        else:
            print("Tabel 2.4.1 tidak ditemukan di database.")
else:
    print("CSV tidak ditemukan di folder output!")
