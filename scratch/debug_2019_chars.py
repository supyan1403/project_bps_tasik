import pdfplumber
import os

pdf_path = r'backend/uploads/kabupaten-tasikmalaya-dalam-angka-2019.pdf'

def debug_chars(pdf_path, page_num):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num - 1]
        print(f"\n--- Page {page_num} Chars ---")
        # Check first 50 characters and their positions
        for char in page.chars[:50]:
            print(f"Char: '{char['text']}', x0: {char['x0']}, top: {char['top']}")

if __name__ == "__main__":
    debug_chars(pdf_path, 40)
