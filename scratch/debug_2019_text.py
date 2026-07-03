import pdfplumber
import os

pdf_path = r'backend/uploads/kabupaten-tasikmalaya-dalam-angka-2019.pdf'

def inspect_page_full_text(pdf_path, page_num):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num - 1]
        
        # Get full text and layout
        print(f"\n--- Page {page_num} Full Text ---")
        print(page.extract_text(layout=True))

if __name__ == "__main__":
    inspect_page_full_text(pdf_path, 40)
