from pdf_table_pipeline import PDFOfflineTableExtractor
pipeline = PDFOfflineTableExtractor()
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2026.pdf"

results = pipeline.process_document(pdf_path, 79, 84)

for idx, res in enumerate(results):
    df = res['dataframe']
    print(f"\nResult {idx} (Page {res['page']}): Columns={list(df.columns)}")
