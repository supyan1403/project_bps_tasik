import pdfplumber
import os

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
with pdfplumber.open(pdf_path) as pdf:
    # Print pages 35 to 60 (0-indexed: 34 to 59)
    for pg in range(34, 60):
        text = pdf.pages[pg].extract_text()
        if not text:
            continue
        first_few_lines = [l.strip() for l in text.split('\n') if l.strip()][:3]
        print(f"Page {pg+1}: {first_few_lines}")
