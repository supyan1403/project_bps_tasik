from pypdf import PdfReader
import re

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"
reader = PdfReader(pdf_path)

# Let's print the text of pages 387 to 399
for p_idx in range(386, 399):
    page_num = p_idx + 1
    text = reader.pages[p_idx].extract_text()
    print(f"=== Page {page_num} ===")
    if text:
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        for l in lines[:15]:
            print(f"  {l}")
    else:
        print("  [No text]")
    print("-" * 50)
