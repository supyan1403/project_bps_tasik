from pypdf import PdfReader
import re

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"
reader = PdfReader(pdf_path)

print("Searching pages 1 to 80 for BAB I or BAB 1 / BAB II or BAB 2:")
for idx in range(80):
    text = reader.pages[idx].extract_text()
    if not text:
        continue
    text_up = text.upper()
    if "BAB" in text_up or "CHAPTER" in text_up:
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        # Check if it has cover-like characteristics
        if len(lines) < 25:
            print(f"--- Page {idx + 1} ---")
            for l in lines:
                print("  ", l)
