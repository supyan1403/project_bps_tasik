from pypdf import PdfReader
import re

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2026.pdf"
reader = PdfReader(pdf_path)

print(f"Total pages: {len(reader.pages)}")

# Search for the page containing "BAB I" or "BAB 1" followed by "GEOGRAFI"
for idx in range(len(reader.pages)):
    text = reader.pages[idx].extract_text()
    if not text:
        continue
    
    # Check if "BAB" and "GEOGRAFI" or "IKLIM" are on the same page
    text_upper = text.upper()
    if "BAB" in text_upper and ("GEOGRAFI" in text_upper or "IKLIM" in text_upper):
        print(f"Match found on PDF Page {idx + 1}:")
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        for l in lines[:5]:
            print(f"  {l}")
        print("-" * 40)
