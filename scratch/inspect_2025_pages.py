import pdfplumber

pdf_path = r"uploads/kabupaten-tasikmalaya-dalam-angka-2025.pdf"
with pdfplumber.open(pdf_path) as pdf:
    for i in range(41, 48):
        print(f"=== PAGE {i+1} ===")
        text = pdf.pages[i].extract_text()
        print(text[:400] if text else "No text")
        print("-" * 50)
