import pdfplumber

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
with pdfplumber.open(pdf_path) as pdf:
    for i in range(30):
        text = pdf.pages[i].extract_text()
        if text and ("DAFTAR ISI" in text.upper() or "TABLE OF CONTENTS" in text.upper()):
            print(f"=== Page {i+1} ===")
            print(text[:1000])
