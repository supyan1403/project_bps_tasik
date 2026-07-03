import os
import sys
sys.path.insert(0, os.path.abspath("."))

import pdfplumber
from pdf_table_pipeline import PDFOfflineTableExtractor

pipeline = PDFOfflineTableExtractor()
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"

with pdfplumber.open(pdf_path) as pdf:
    page = pdf.pages[73]
    table = page.extract_tables()[0]
    
    print("Raw table row count:", len(table))
    print("Raw table col count:", len(table[0]))
    
    df = pipeline._clean_table(table)
    print("\nAfter clean_table:")
    print("Shape:", df.shape)
    print("Columns:", list(df.columns))
    print("Index:", list(df.index))
    print(df.to_string())
