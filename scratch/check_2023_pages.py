import pdfplumber

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2023.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Page index is 0-indexed (e.g. page 79 is index 78)
    for idx in range(77, 84):
        print(f"\n=== PHYSICAL PAGE {idx + 1} ===")
        page = pdf.pages[idx]
        text = page.extract_text()
        print(text[:1000] if text else "No text extracted")
