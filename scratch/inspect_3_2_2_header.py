import re
import pdfplumber
import pandas as pd
from pdf_table_pipeline import PDFOfflineTableExtractor

pipeline = PDFOfflineTableExtractor()
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2026.pdf"

# Page 87 is Table 3.2.2
with pdfplumber.open(pdf_path) as pdf:
    page = pdf.pages[86] # page 87
    page = page.filter(lambda obj: obj.get("object_type") != "char" or obj.get("size", 0) < 15)
    tables = page.extract_tables()
    for idx, table in enumerate(tables):
        if pipeline._is_valid_statistic_table(table):
            # Let's find index_row
            index_row_idx = -1
            for i, row in enumerate(table):
                if row and row[0]:
                    cell_val = str(row[0]).strip()
                    if re.match(r'^\(\d+\)$', cell_val):
                        index_row_idx = i
                        break
            
            print(f"Table index row: {index_row_idx}")
            header_rows = table[:index_row_idx]
            header_df = pd.DataFrame(header_rows)
            print("Raw Header DF:")
            print(header_df)
