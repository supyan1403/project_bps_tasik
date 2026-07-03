import pdfplumber

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
with pdfplumber.open(pdf_path) as pdf:
    for i in range(5, 30):
        text = pdf.pages[i].extract_text()
        if text and "5.1.1" in text:
            print(f"=== Page {i+1} ===")
            for line in text.split('\n'):
                if "5.1.1" in line:
                    print(line)
