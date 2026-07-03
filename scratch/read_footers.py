import pdfplumber
import re

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
with pdfplumber.open(pdf_path) as pdf:
    # Look at pages 40 to 60
    for p in range(40, 60):
        page = pdf.pages[p - 1]
        text = page.extract_text()
        if not text:
            print(f"Page {p}: EMPTY")
            continue
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        # Print page number and the last 2 lines
        print(f"Page {p}: {lines[-2:] if len(lines) >= 2 else lines}")
