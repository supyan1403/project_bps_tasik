from pypdf import PdfReader

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2026.pdf"
reader = PdfReader(pdf_path)

for idx in [39, 40, 41]: # Pages 40, 41, 42 (0-indexed: 39, 40, 41)
    text = reader.pages[idx].extract_text()
    print(f"=== PDF Page {idx + 1} ===")
    if text:
        for line in text.split("\n")[:15]:
            print(f"  {line.strip()}")
    else:
        print("  [Empty or scanned image]")
    print("-" * 50)
