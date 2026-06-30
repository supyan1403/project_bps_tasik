from extract_toc import get_toc
import json

pdfs = [
    "backend/uploads/kabupaten-tasikmalaya-dalam-angka-2024.pdf",
    "backend/uploads/kabupaten-tasikmalaya-dalam-angka-2025.pdf"
]

for pdf_path in pdfs:
    print("Testing: " + pdf_path)
    try:
        toc = get_toc(pdf_path)
        print(f"Detected {len(toc)} chapters:")
        print(json.dumps(toc, indent=4))
    except Exception as e:
        print(f"Error: {e}")
