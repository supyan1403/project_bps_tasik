import pdfplumber

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"

with pdfplumber.open(pdf_path) as pdf:
    # Page 395 (index 394) - Tabel 1.3
    print("=== Table on Page 395 ===")
    p395 = pdf.pages[394]
    t395 = p395.extract_tables()
    for t in t395:
        for row in t[:5]:
            print(row)
            
    # Page 396 (index 395) - Tabel 1.4
    print("\n=== Table on Page 396 ===")
    p396 = pdf.pages[395]
    t396 = p396.extract_tables()
    for t in t396:
        for row in t[:5]:
            print(row)
