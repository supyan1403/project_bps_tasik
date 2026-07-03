import os
import sys
sys.path.insert(0, os.path.abspath("."))

import pdfplumber
from pdf_table_pipeline import PDFOfflineTableExtractor

pipeline = PDFOfflineTableExtractor()
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"

with pdfplumber.open(pdf_path) as pdf:
    page = pdf.pages[50] # Index 50 is Physical Page 51
    tables = page.extract_tables()
    for idx, table in enumerate(tables):
        print(f"--- Raw Table {idx} ---")
        for row in table[:25]:
            print(row)
            
        print("\n--- Cleaned Table ---")
        df = pipeline._clean_table(table)
        print(df.to_string())
