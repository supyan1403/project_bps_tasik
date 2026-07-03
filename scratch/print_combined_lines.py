import pdfplumber
import re

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
with pdfplumber.open(pdf_path) as pdf:
    total_pages = len(pdf.pages)
    
    toc_lines = []
    for i in range(5, min(35, total_pages)):
        text = pdf.pages[i].extract_text()
        if not text: continue
        if "DAFTAR ISI" in text.upper() or "CONTENTS" in text.upper() or "DAFTAR TABEL" in text.upper() or "LIST OF TABLES" in text.upper():
            toc_lines.extend(text.split('\n'))
            
    combined_table_lines = []
    i = 0
    while i < len(toc_lines):
        line = toc_lines[i].strip()
        if not line:
            i += 1
            continue
        
        starts_with_table = re.match(r'^([1-9]|1[0-9])\.(\d+)(?:\.(\d+))?\b', line)
        ends_with_page = re.search(r'\d+$', line)
        
        if starts_with_table and not ends_with_page:
            combined_line = line
            j = i + 1
            while j < len(toc_lines):
                next_line = toc_lines[j].strip()
                if not next_line:
                    j += 1
                    continue
                if re.match(r'^([1-9]|1[0-9])\.(\d+)(?:\.(\d+))?\b', next_line) or re.match(r'^\d+\.\s+', next_line):
                    break
                if re.search(r'\d+$', next_line):
                    combined_line += " " + next_line
                    i = j
                    break
                else:
                    combined_line += " " + next_line
                j += 1
            combined_table_lines.append(combined_line)
        else:
            combined_table_lines.append(line)
        i += 1
        
    for idx, line in enumerate(combined_table_lines):
        # Print lines that start with table numbers
        if re.match(r'^([1-9]|1[0-9])\.(\d+)(?:\.(\d+))?\b', line):
            print(f"[{idx}] {line}")
