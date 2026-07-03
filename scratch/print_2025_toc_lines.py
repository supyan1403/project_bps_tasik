import pdfplumber
import re

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"
with pdfplumber.open(pdf_path) as pdf:
    total_pages = len(pdf.pages)
    toc_lines = []
    for i in range(9, min(36, total_pages)):
        text = pdf.pages[i].extract_text()
        if not text: continue
        toc_lines.extend(text.split('\n'))
        
    for idx, line in enumerate(toc_lines):
        if re.search(r'^\d+\.\s+', line):
            print(f"[{idx}] {line}")
