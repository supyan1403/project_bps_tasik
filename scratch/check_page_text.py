import pdfplumber

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Pages are 0-indexed. Page 78 is index 77, Page 79 is index 78.
    for page_num in [77, 78, 79]:
        print(f"\n=== PAGE {page_num + 1} ===")
        page = pdf.pages[page_num]
        text = page.extract_text()
        print(text[:1000] if text else "No text extracted")
