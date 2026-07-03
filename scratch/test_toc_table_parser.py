import pdfplumber
import re
import os
from collections import Counter

def is_actual_page_number(s):
    try:
        val = int(s)
        if 2010 <= val <= 2030:
            return False
        if val > 600:
            return False
        return True
    except:
        return False

def parse_bps_toc_v7(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        
        # Scan pages 10 to 35
        toc_lines = []
        for i in range(9, min(36, total_pages)):
            text = pdf.pages[i].extract_text()
            if not text:
                continue
            toc_lines.extend(text.split('\n'))
            
        # Combine multi-line chapter entries
        combined_chapter_lines = []
        i = 0
        while i < len(toc_lines):
            line = toc_lines[i].strip()
            if not line:
                i += 1
                continue
            starts_with_num = re.match(r'^(\d+)\.\s+', line)
            m_end = re.search(r'(\d+)$', line)
            ends_with_page = bool(m_end and is_actual_page_number(m_end.group(1)))
            
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
                    if m_next_end and is_actual_page_number(m_next_end.group(1)):
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
            
        # Parse chapter titles and their printed start pages from TOC
        chapters = []
        for line in combined_chapter_lines:
            m_ch = re.search(r'^(\d+)\.\s+(.*?)\s*[\s\.]+\s*(\d+)$', line)
            if m_ch and is_actual_page_number(m_ch.group(3)):
                num = int(m_ch.group(1))
                title = m_ch.group(2).strip()
                printed_start = int(m_ch.group(3))
                if "/" in title:
                    title = title.split("/")[0].strip()
                title = title.title()
                title = re.sub(r'\bAnd\b', 'dan', title, flags=re.IGNORECASE)
                if 1 <= num <= 20 and not any(c['num'] == num for c in chapters):
                    chapters.append({
                        "num": num,
                        "title": f"Bab {num} - {title}",
                        "raw_start": printed_start
                    })
                    
        if not chapters:
            return []
            
        # Combine multi-line table entries
        combined_table_lines = []
        i = 0
        while i < len(toc_lines):
            line = toc_lines[i].strip()
            if not line:
                i += 1
                continue
            starts_with_table = re.match(r'^([1-9]|1[0-9])\.(\d+)(?:\.(\d+))?\b', line)
            m_end = re.search(r'(\d+)$', line)
            ends_with_page = bool(m_end and is_actual_page_number(m_end.group(1)))
            
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
                    m_next_end = re.search(r'(\d+)$', next_line)
                    if m_next_end and is_actual_page_number(m_next_end.group(1)):
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
            
        # Parse table printed pages
        raw_tables = []
        for line in combined_table_lines:
            m_t = re.search(r'^([1-9]|1[0-9])\.(\d+)(?:\.(\d+))?\s+.*?\.+\s*(\d+)$', line)
            if m_t and is_actual_page_number(m_t.group(4)):
                raw_tables.append({
                    "ch_num": int(m_t.group(1)),
                    "printed_page": int(m_t.group(4))
                })
                
        # Calculate dynamic offset using footer scanning
        offsets = []
        for p in range(40, min(80, total_pages)):
            text = pdf.pages[p - 1].extract_text()
            if not text:
                continue
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            if not lines:
                continue
            last_line = lines[-1]
            
            printed_page = None
            m_start = re.match(r'^(\d+)\b', last_line)
            if m_start:
                printed_page = int(m_start.group(1))
            else:
                m_end = re.search(r'\b(\d+)$', last_line)
                if m_end:
                    printed_page = int(m_end.group(1))
                    
            if printed_page and 1 <= printed_page < 150:
                offsets.append(p - printed_page)
                
        offset = Counter(offsets).most_common(1)[0][0] if offsets else 38
        print(f"Calculated offset: {offset}")
        
        # Step 2: Group tables by their prefix (raw grouping)
        table_pages = {}
        for t in raw_tables:
            ch = t["ch_num"]
            page = t["printed_page"]
            if ch not in table_pages:
                table_pages[ch] = []
            table_pages[ch].append(page)
            
        # Step 3: Validate and identify trusted TOC start pages (no typos)
        # S_C is trusted if F_C - S_C <= 8.
        trusted_starts = {}
        for c in chapters:
            num = c["num"]
            raw_s = c["raw_start"]
            
            # Find first table printed page for this chapter in raw grouping
            f_c = min(table_pages[num]) if (num in table_pages and table_pages[num]) else raw_s
            
            if num == 1:
                trusted_starts[1] = raw_s
            else:
                # If the difference between the first table and the TOC start is within 8 pages, it's trusted!
                if f_c - raw_s <= 8:
                    trusted_starts[num] = raw_s
                    
        # Now re-group tables by filtering out outliers using trusted_starts
        filtered_table_pages = {}
        for t in raw_tables:
            ch = t["ch_num"]
            page = t["printed_page"]
            
            is_outlier = False
            for next_ch in range(ch + 1, 20):
                if next_ch in trusted_starts:
                    # Filter out if it exceeds a trusted start page of a later chapter
                    if page >= trusted_starts[next_ch]:
                        is_outlier = True
                        break
            if not is_outlier:
                if ch not in filtered_table_pages:
                    filtered_table_pages[ch] = []
                filtered_table_pages[ch].append(page)
                
        # Step 4: Map chapter boundaries
        babs = []
        for idx, c in enumerate(chapters):
            num = c["num"]
            
            # Start page of current chapter
            if num == 1:
                f1_pdf = (min(filtered_table_pages[1]) + offset) if (1 in filtered_table_pages and filtered_table_pages[1]) else 47
                cover_start = max(30, f1_pdf - 6)
            else:
                prev_num = chapters[idx - 1]["num"]
                if prev_num in filtered_table_pages and filtered_table_pages[prev_num]:
                    prev_last_printed = max(filtered_table_pages[prev_num])
                    cover_start = prev_last_printed + offset + 1
                else:
                    cover_start = babs[-1]["end_page"] + 1
                    
            # End page of current chapter
            if num in filtered_table_pages and filtered_table_pages[num]:
                last_printed = max(filtered_table_pages[num])
                cover_end = last_printed + offset
            else:
                cover_end = cover_start + 10
                
            babs.append({
                "num": num,
                "title": c["title"],
                "start_page": cover_start,
                "end_page": cover_end
            })
            
        # Adjust end pages to eliminate gaps
        babs.sort(key=lambda x: x["start_page"])
        for i in range(len(babs) - 1):
            babs[i]["end_page"] = babs[i+1]["start_page"] - 1
        babs[-1]["end_page"] = total_pages
        
        return babs

# Test it on all available PDFs in uploads!
uploads_dir = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads"
for f in os.listdir(uploads_dir):
    if f.endswith(".pdf"):
        path = os.path.join(uploads_dir, f)
        print(f"\n=== Testing parser v7 on {f} ===")
        babs = parse_bps_toc_v7(path)
        for b in babs:
            print(b)
