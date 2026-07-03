import pdfplumber

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Page 81 is index 80, Page 83 is index 82.
    for page_num in [80, 82]:
        print(f"\n=== PAGE {page_num + 1} ===")
        page = pdf.pages[page_num]
        text = page.extract_text()
        print(text[:1000] if text else "No text extracted")
