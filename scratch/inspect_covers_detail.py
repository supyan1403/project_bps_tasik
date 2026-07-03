import pdfplumber

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
with pdfplumber.open(pdf_path) as pdf:
    for pg_idx in [34, 35, 40, 41, 52, 53]:
        print(f"=== Page {pg_idx+1} ===")
        text = pdf.pages[pg_idx].extract_text()
        print(repr(text))
