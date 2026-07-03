import pdfplumber

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
with pdfplumber.open(pdf_path) as pdf:
    total_pages = len(pdf.pages)
    
    toc_lines = []
    for i in range(5, min(35, total_pages)):
        text = pdf.pages[i].extract_text()
        if not text: continue
        if "DAFTAR ISI" in text.upper() or "CONTENTS" in text.upper() or "DAFTAR TABEL" in text.upper() or "LIST OF TABLES" in text.upper():
            toc_lines.extend(text.split('\n'))
            
    for i in range(50, min(90, len(toc_lines))):
        print(f"{i}: {repr(toc_lines[i])}")
