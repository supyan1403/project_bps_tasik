import os
import pdfplumber

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"

with pdfplumber.open(pdf_path) as pdf:
    for page_num in [75, 76, 77]: # Halaman fisik 76, 77, 78 (0-indexed: 75, 76, 77)
        page = pdf.pages[page_num]
        print(f"\n================ PHYSICAL PAGE {page_num + 1} ================")
        text = page.extract_text()
        print("First 300 chars of text:")
        print(text[:300] if text else "No text extracted")
        
        tables = page.extract_tables()
        print(f"Detected {len(tables)} tables on this page.")
        if tables:
            print(f"Table 0 shape: {len(tables[0])} rows x {len(tables[0][0])} cols")
            print("First 3 rows:")
            for r in tables[0][:3]:
                print(r)
