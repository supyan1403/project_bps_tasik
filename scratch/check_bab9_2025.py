from pypdf import PdfReader

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"
reader = PdfReader(pdf_path)

# Let's inspect the text of page 365 (index 364) where Bab 9 cover is
text = reader.pages[364].extract_text()
print("=== Page 365 ===")
print(text)
