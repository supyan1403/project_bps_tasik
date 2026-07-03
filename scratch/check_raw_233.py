import os
import sys
sys.path.insert(0, os.path.abspath("."))

import pdfplumber
from pdf_table_pipeline import PDFOfflineTableExtractor

pipeline = PDFOfflineTableExtractor()
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"

with pdfplumber.open(pdf_path) as pdf:
    page = pdf.pages[73] # Physical Page 74 is index 73
    print(f"=== PHYSICAL PAGE 74 ===")
    text = page.extract_text()
    print("Page Text snippet:\n", text[:1000] if text else "No text")
    
    tables = page.extract_tables()
    print(f"\nDetected {len(tables)} tables on this page.")
    for idx, table in enumerate(tables):
        print(f"\n--- Raw Table {idx} ---")
        for row in table[:15]:
            print(row)
            
        print(f"\n--- Cleaned Table {idx} ---")
        df = pipeline._clean_table(table)
        print(df.to_string())
