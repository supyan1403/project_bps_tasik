import os
from pypdf import PdfReader

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2026.pdf"
reader = PdfReader(pdf_path)

# Let's search pages 35 to 45 for the string "BAB" or "GEOGRAFI"
for i in range(35, 50):
    text = reader.pages[i].extract_text()
    if "GEOGRAFI" in text.upper() or "BAB" in text.upper():
        print(f"--- Page {i + 1} (PDF Index {i}) ---")
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        for line in lines[:10]:
            print("  ", line)
