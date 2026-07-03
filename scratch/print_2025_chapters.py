import pdfplumber
import re

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2025.pdf"
with pdfplumber.open(pdf_path) as pdf:
    total_pages = len(pdf.pages)
    toc_lines = []
    for i in range(9, min(36, total_pages)):
        text = pdf.pages[i].extract_text()
        if not text: continue
        toc_lines.extend(text.split('\n'))
        
    combined_chapter_lines = []
    i = 0
    while i < len(toc_lines):
        line = toc_lines[i].strip()
        if not line:
            i += 1
            continue
        starts_with_num = re.match(r'^(\d+)\.\s+', line)
        m_end = re.search(r'(\d+)$', line)
        ends_with_page = bool(m_end and int(m_end.group(1)) < 600) # Simple actual page check
        
        if starts_with_num and not ends_with_page:
            combined_line = line
            j = i + 1
            while j < len(toc_lines):
                next_line = toc_lines[j].strip()
                if not next_line:
                    j += 1
                    continue
                if re.match(r'^\d+\.\s+', next_line):
                    break
                m_next_end = re.search(r'(\d+)$', next_line)
                if m_next_end and int(m_next_end.group(1)) < 600:
                    combined_line += " " + next_line
                    i = j
                    break
                else:
                    combined_line += " " + next_line
                j += 1
            combined_chapter_lines.append(combined_line)
        else:
            combined_chapter_lines.append(line)
        i += 1
        
    chapters = []
    for line in combined_chapter_lines:
        m_ch = re.search(r'^(\d+)\.\s+(.*?)\s*[\s\.]+\s*(\d+)$', line)
        if m_ch:
            num = int(m_ch.group(1))
            title = m_ch.group(2).strip()
            printed_start = int(m_ch.group(3))
            print(f"Candidate chapter line: {line} -> num={num}, start={printed_start}")
