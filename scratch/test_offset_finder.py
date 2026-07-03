import pdfplumber
import re
import os
from collections import Counter

def find_pdf_offset(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        offsets = []
        
        # Scan pages 40 to 80
        for p in range(40, min(80, total_pages)):
            text = pdf.pages[p - 1].extract_text()
            if not text:
                continue
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            if not lines:
                continue
            last_line = lines[-1]
            
            # Extract printed page number from footer
            printed_page = None
            m_start = re.match(r'^(\d+)\b', last_line)
            if m_start:
                printed_page = int(m_start.group(1))
            else:
                m_end = re.search(r'\b(\d+)$', last_line)
                if m_end:
                    printed_page = int(m_end.group(1))
                    
            if printed_page and 1 <= printed_page < 100:
                offset = p - printed_page
                offsets.append(offset)
                
        if offsets:
            most_common = Counter(offsets).most_common(1)[0][0]
            return most_common
        return 38 # Fallback

pdf_path_2024 = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
print(f"2024 Offset: {find_pdf_offset(pdf_path_2024)}")

pdf_path_2025 = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"
if os.path.exists(pdf_path_2025):
    print(f"2025 Offset: {find_pdf_offset(pdf_path_2025)}")
    
pdf_path_2026 = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2026.pdf"
if os.path.exists(pdf_path_2026):
    print(f"2026 Offset: {find_pdf_offset(pdf_path_2026)}")
