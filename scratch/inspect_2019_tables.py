import pdfplumber
import os

pdf_path = r'backend/uploads/kabupaten-tasikmalaya-dalam-angka-2019.pdf'

if not os.path.exists(pdf_path):
    print(f"File not found: {pdf_path}")
    exit()

def inspect_pdf_pages(pdf_path, page_start=39, page_end=42):
    with pdfplumber.open(pdf_path) as pdf:
        for i in range(page_start - 1, min(page_end, len(pdf.pages))):
            page = pdf.pages[i]
            print(f"\n--- Page {i+1} ---")
            
            # Extract tables with different settings
            print("Trying default table extraction:")
            tables = page.extract_tables()
            print(f"Found {len(tables)} tables.")
            
            print("\nTrying with vertical_strategy='lines':")
            tables_lines = page.extract_tables(table_settings={"vertical_strategy": "lines", "horizontal_strategy": "lines"})
            print(f"Found {len(tables_lines)} tables.")
            
            # Extract basic text to see structure
            print("\nText snippet:")
            print(page.extract_text()[:500])

if __name__ == "__main__":
    inspect_pdf_pages(pdf_path, page_start=39, page_end=42) 
