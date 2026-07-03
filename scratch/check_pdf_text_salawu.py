import pdfplumber

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Cek halaman 50, 51, 52 (index 49, 50, 51)
    for idx in range(49, 52):
        print(f"\n=== PHYSICAL PAGE {idx + 1} ===")
        page = pdf.pages[idx]
        text = page.extract_text()
        print(text if text else "No text extracted")
