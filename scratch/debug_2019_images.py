import pdfplumber
import os

pdf_path = r'backend/uploads/kabupaten-tasikmalaya-dalam-angka-2019.pdf'

def inspect_page_image(pdf_path, page_num):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num - 1]
        
        # Check for images
        print(f"\n--- Page {page_num} Images ---")
        print(f"Number of images: {len(page.images)}")
        for i, img in enumerate(page.images):
            print(f"Image {i}: {img}")

if __name__ == "__main__":
    inspect_page_image(pdf_path, 40)
