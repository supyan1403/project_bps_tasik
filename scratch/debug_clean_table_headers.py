import os
import sys
import re
import pandas as pd
sys.path.insert(0, os.path.abspath("."))

import pdfplumber
from pdf_table_pipeline import PDFOfflineTableExtractor

pipeline = PDFOfflineTableExtractor()
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"

with pdfplumber.open(pdf_path) as pdf:
    page = pdf.pages[73]
    table = page.extract_tables()[0]
    
    # Simulasikan apa yang dideteksi oleh _clean_table
    index_row_idx = -1
    for i, row in enumerate(table):
        if row and row[0]:
            if re.match(r'^\(\d+\)$', str(row[0]).strip()):
                index_row_idx = i
                break
                
    header_rows = table[:index_row_idx]
    header_df = pd.DataFrame(header_rows)
    header_df = header_df.ffill(axis=1)
    
    clean_headers = []
    for col in header_df.columns:
        parts = []
        for val in header_df[col]:
            if val is not None and str(val).strip() and str(val).lower() not in ["none", "nan"]:
                parts.append(str(val))
        combined = " - ".join(parts)
        if not combined:
            combined = "Kolom_Kosong"
        clean_headers.append(combined)
        
    print("Clean Headers Sim:", clean_headers)
