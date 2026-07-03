import pdfplumber
import os

pdf_path = r'backend/uploads/kabupaten-tasikmalaya-dalam-angka-2019.pdf'

def inspect_page_visual(pdf_path, page_num):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num - 1]
        
        # Get visual objects
        print(f"\n--- Page {page_num} Visual Debug ---")
        print("Lines:", len(page.lines))
        print("Rects:", len(page.rects))
        print("Curves:", len(page.curves))
        
        # Inspect a few objects
        for i, rect in enumerate(page.rects[:10]):
            print(f"Rect {i}: {rect}")

if __name__ == "__main__":
    inspect_page_visual(pdf_path, 40)
