import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from database import SessionLocal
import models
import json

db = SessionLocal()
try:
    docs = db.query(models.Document).all()
    base_backend = os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend"))
    
    for doc in docs:
        output_path = os.path.join(base_backend, "hasil_ekstraksi_web", f"doc_{doc.id}")
        if not os.path.exists(output_path):
            continue
            
        print(f"Scanning folder for Document {doc.id} ({doc.filename}): {output_path}")
        count = 0
        
        for sub in os.listdir(output_path):
            sub_path = os.path.join(output_path, sub)
            if os.path.isdir(sub_path) and sub.startswith("Ekstraksi_Hal_"):
                # Load metadata.json mapping safe filenames to original full titles
                title_mapping = {}
                metadata_path = os.path.join(sub_path, "metadata.json")
                if os.path.exists(metadata_path):
                    try:
                        with open(metadata_path, "r", encoding="utf-8") as f:
                            title_mapping = json.load(f).get("title_mapping", {})
                    except Exception as e:
                        print(f"  Error loading metadata: {e}")

                for root, _, files in os.walk(sub_path):
                    for file in files:
                        if file.endswith(".csv"):
                            csv_full_path = os.path.abspath(os.path.join(root, file))
                            rel_csv_path = os.path.relpath(csv_full_path, base_backend)
                            
                            # Ambil judul lengkap asli dari metadata jika ada, jika tidak pakai nama file
                            table_name = title_mapping.get(file)
                            if not table_name:
                                table_name = file.replace(".csv", "").replace(" __SLASH__ ", "/").replace("__SLASH__", "/")
                            else:
                                table_name = table_name.replace(" __SLASH__ ", "/").replace("__SLASH__", "/")
                            
                            # Check database
                            existing_table = db.query(models.ExtractedTable).filter_by(document_id=doc.id, table_name=table_name).first()
                            if not existing_table:
                                db_table = models.ExtractedTable(document_id=doc.id, table_name=table_name, csv_path=rel_csv_path)
                                db.add(db_table)
                                count += 1
                            else:
                                existing_table.csv_path = rel_csv_path
                                
        db.commit()
        if count > 0:
            print(f"  Registered {count} new tables.")
            
    print("All folders synchronized successfully.")
finally:
    db.close()
