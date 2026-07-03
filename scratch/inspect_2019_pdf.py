import pdfplumber
import os

pdf_path = r'backend/uploads/kabupaten-tasikmalaya-dalam-angka-2019.pdf'

if not os.path.exists(pdf_path):
    print(f"File not found: {pdf_path}")
    exit()

def inspect_pdf(pdf_path, page_start=1, page_end=5):
    with pdfplumber.open(pdf_path) as pdf:
        for i in range(page_start - 1, min(page_end, len(pdf.pages))):
            page = pdf.pages[i]
            print(f"\n--- Page {i+1} ---")
            
            # Extract tables
            tables = page.extract_tables()
            print(f"Found {len(tables)} tables.")
            for j, table in enumerate(tables):
                print(f"Table {j+1} structure:")
                for row in table[:5]: # print first 5 rows
                    print(row)

            # Extract basic text to see structure
            print("\nText snippet:")
            print(page.extract_text()[:500])

if __name__ == "__main__":
    inspect_pdf(pdf_path, page_start=10, page_end=15) # Assuming tables start a bit in
