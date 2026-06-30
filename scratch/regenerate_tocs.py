import os
import sqlite3
import json
import sys

# Add root folder to python path to import extract_toc
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from extract_toc import get_toc

db_path = r"D:\Kuliah\KP\project_bps_tasik\backend\bps_dashboard.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, filename FROM documents")
docs = cursor.fetchall()

print(f"Found {len(docs)} documents in database.")

for doc_id, filename in docs:
    print(f"\nProcessing Doc ID {doc_id}: {filename}")
    
    # Locate PDF
    pdf_paths = [
        os.path.join(r"D:\Kuliah\KP\project_bps_tasik\uploads", filename),
        os.path.join(r"D:\Kuliah\KP\project_bps_tasik\backend\uploads", filename)
    ]
    
    pdf_path = None
    for p in pdf_paths:
        if os.path.exists(p):
            pdf_path = p
            break
            
    if not pdf_path:
        print(f"Error: Could not find PDF file for {filename}")
        continue
        
    print(f"Found PDF at: {pdf_path}")
    
    # Extract TOC
    try:
        babs = get_toc(pdf_path)
        print(f"Extracted {len(babs)} chapters.")
        
        # Save to both potential hasil_ekstraksi_web directories
        out_dirs = [
            os.path.join(r"D:\Kuliah\KP\project_bps_tasik\hasil_ekstraksi_web", f"doc_{doc_id}"),
            os.path.join(r"D:\Kuliah\KP\project_bps_tasik\backend\hasil_ekstraksi_web", f"doc_{doc_id}")
        ]
        
        for out_dir in out_dirs:
            os.makedirs(out_dir, exist_ok=True)
            out_file = os.path.join(out_dir, "toc.json")
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(babs, f, indent=4)
            print(f"Saved TOC to: {out_file}")
            
    except Exception as e:
        print(f"Error extracting TOC: {e}")

conn.close()
print("\nRegeneration finished successfully!")
