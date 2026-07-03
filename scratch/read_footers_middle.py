import pdfplumber

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
with pdfplumber.open(pdf_path) as pdf:
    for p in range(140, 180):
        page = pdf.pages[p - 1]
        text = page.extract_text()
        if not text:
            continue
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        # Print page and the last line
        print(f"Page {p}: {lines[-1] if lines else 'EMPTY'}")
