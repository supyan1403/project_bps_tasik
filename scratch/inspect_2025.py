from pypdf import PdfReader
import re

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"
reader = PdfReader(pdf_path)

print(f"Total pages in 2025 PDF: {len(reader.pages)}")

# Print PDF Outline/Bookmarks first to see if it exists
outline = reader.outline
if outline:
    print("Found PDF Bookmarks/Outline:")
    def print_outline(item, depth=0):
        if isinstance(item, list):
            for sub in item:
                print_outline(sub, depth+1)
        else:
            print("  " * depth + f"- {item.title} (Page: {reader.get_destination_page_number(item) + 1})")
    print_outline(outline)
else:
    print("No outline/bookmarks found in 2025 PDF.")

# Let's search pages for BAB/CHAPTER
matches = []
for idx in range(len(reader.pages)):
    text = reader.pages[idx].extract_text()
    if not text:
        continue
    text_up = text.upper()
    if "BAB" in text_up or "CHAPTER" in text_up:
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        if len(lines) < 20: # potentially a cover page
            matches.append((idx + 1, lines))

print(f"\nPotential cover pages found ({len(matches)}):")
for page_num, lines in matches[:15]:
    print(f"--- Page {page_num} ({len(lines)} lines) ---")
    for l in lines[:10]:
        print("  ", l)
