import pdfplumber

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
with pdfplumber.open(pdf_path) as pdf:
    for i in [14, 15, 16]:
        text = pdf.pages[i].extract_text()
        print(f"=== Page {i+1} ===")
        print(text)
