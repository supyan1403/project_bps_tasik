import pdfplumber
import re

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Scan pages 57 to 79 (indices 56 to 78)
    for p_idx in range(56, 78):
        page_num = p_idx + 1
        text = pdf.pages[p_idx].extract_text()
        if not text:
            continue
        # Look for "Tabel" or "Table"
        match = re.search(r'(?:Tabel|Table)\s+(\d+(?:\.\d+)+)', text, re.IGNORECASE)
        if match:
            print(f"Page {page_num}: {match.group(0)}")
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            for l in lines[:5]:
                print(f"  {l}")
