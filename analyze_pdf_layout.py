import pdfplumber

pdfs = [
    "backend/uploads/kabupaten-tasikmalaya-dalam-angka-2024.pdf",
    "backend/uploads/kabupaten-tasikmalaya-dalam-angka-2025.pdf"
]

for pdf_path in pdfs:
    print("=" * 80)
    print("ANALYZING: " + pdf_path)
    print("=" * 80)
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i in range(min(100, len(pdf.pages))):
                page = pdf.pages[i]
                text = page.extract_text()
                if text:
                    if "BAB" in text.upper() or "CHAPTER" in text.upper():
                        print("--- PAGE " + str(i+1) + " ---")
                        print(text)
    except Exception as e:
        print("Error analyzing " + pdf_path + ": " + str(e))
