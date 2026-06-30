import pdfplumber
import re

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Scan pages 193 to 315 (indices 192 to 314)
    for p_idx in range(192, 314):
        page_num = p_idx + 1
        text = pdf.pages[p_idx].extract_text()
        if not text:
            continue
        match = re.search(r'(?:Tabel|Table)\s+(\d+(?:\.\d+)+)', text, re.IGNORECASE)
        if match:
            tnum = match.group(1)
            if "5.2.1" in tnum or tnum.startswith("5.2"):
                print(f"Page {page_num}: {match.group(0)}")
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                for l in lines[:5]:
                    print(f"  {l}")
