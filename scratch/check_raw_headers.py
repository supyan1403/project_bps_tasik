import os
import sys
sys.path.insert(0, os.path.abspath("."))

import pdfplumber
from pdf_table_pipeline import PDFOfflineTableExtractor

pipeline = PDFOfflineTableExtractor()
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2023.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Page 81 (index 80)
    page_81 = pdf.pages[80]
    tables_81 = page_81.extract_tables()
    for idx, table in enumerate(tables_81):
        if pipeline._is_valid_statistic_table(table):
            df_81 = pipeline._clean_table(table)
            print("Page 81 Table Columns:", list(df_81.columns))

    # Page 82 (index 81)
    page_82 = pdf.pages[81]
    tables_82 = page_82.extract_tables()
    for idx, table in enumerate(tables_82):
        if pipeline._is_valid_statistic_table(table):
            df_82 = pipeline._clean_table(table)
            print("Page 82 Table Columns:", list(df_82.columns))
