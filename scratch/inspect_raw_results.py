import pdfplumber
import pandas as pd
from pdf_table_pipeline import PDFOfflineTableExtractor

pipeline = PDFOfflineTableExtractor()
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\uploads\2026.pdf"

# Let's extract from page 79 to 80 (0-indexed 78 to 80)
results = pipeline.process_document(pdf_path, 79, 80)
print(f"Extracted {len(results)} tables.")

for idx, res in enumerate(results):
    df = res['dataframe']
    print(f"\n--- Result {idx} (Page {res['page']}) ---")
    print(f"Columns: {list(df.columns)}")
    print(f"Shape: {df.shape}")
    print("Head:\n", df.head(3))
