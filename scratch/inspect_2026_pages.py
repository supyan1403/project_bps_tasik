from pypdf import PdfReader

pdf_path = r"D:\Kuliah\KP\project_bps_tasik\uploads\kabupaten-tasikmalaya-dalam-angka-2026.pdf"
reader = PdfReader(pdf_path)

# Let's inspect the text of pages 350 to 368 of the 2026 PDF
for p_idx in range(349, 368):
    page_num = p_idx + 1
    text = reader.pages[p_idx].extract_text()
    if text:
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        for l in lines[:5]:
            if "BAB" in l.upper() or "CHAPTER" in l.upper() or "PERDAGANGAN" in l.upper() or "PENDAPATAN" in l.upper():
                print(f"Page {page_num}: {l}")
