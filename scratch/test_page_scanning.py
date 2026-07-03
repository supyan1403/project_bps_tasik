import pdfplumber
import re
import os

def parse_bps_toc_by_scanning(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        
        # Step 1: Scan Table of Contents to get names and order of chapters
        toc_lines = []
        for i in range(5, min(35, total_pages)):
            text = pdf.pages[i].extract_text()
            if not text:
                continue
            if "DAFTAR ISI" in text.upper() or "CONTENTS" in text.upper():
                toc_lines.extend(text.split('\n'))
                
        # Combine multi-line entries
        combined_lines = []
        i = 0
        while i < len(toc_lines):
            line = toc_lines[i].strip()
            if not line:
                i += 1
                continue
            starts_with_num = re.match(r'^(\d+)\.\s+', line)
            ends_with_page = re.search(r'\d+$', line)
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
                    if re.search(r'\d+$', next_line):
                        combined_line += " " + next_line
                        i = j
                        break
                    else:
                        combined_line += " " + next_line
                    j += 1
                combined_lines.append(combined_line)
            else:
                combined_lines.append(line)
            i += 1
            
        raw_chapters = []
        for line in combined_lines:
            match = re.search(r'^(\d+)\.\s+(.*?)\s*[\s\.]+\s*(\d+)$', line)
            if match:
                bab_num = int(match.group(1))
                title_part = match.group(2).strip()
                if "/" in title_part:
                    title_part = title_part.split("/")[0].strip()
                title_part = title_part.title()
                title_part = re.sub(r'\bAnd\b', 'dan', title_part, flags=re.IGNORECASE)
                
                if 1 <= bab_num <= 20 and not any(c['num'] == bab_num for c in raw_chapters):
                    raw_chapters.append({
                        "num": bab_num,
                        "title": f"Bab {bab_num} - {title_part}"
                    })
                    
        if not raw_chapters:
            return []
            
        # Step 2: Scan every page from page 30 to end to find which Bab it contains tables for
        # We look for "Tabel X." or "Table X."
        page_babs = {}
        for p in range(30, total_pages + 1):
            text = pdf.pages[p - 1].extract_text()
            if not text:
                continue
                
            # Find all matching table numbers
            babs_found = []
            for m in re.finditer(r'\b(?:Tabel|Table)\s*([1-9]\d*)\b', text, re.IGNORECASE):
                babs_found.append(int(m.group(1)))
            # If found, set page to the most frequent or last found Bab number
            if babs_found:
                # filter to valid chapter numbers
                valid_found = [b for b in babs_found if any(c['num'] == b for c in raw_chapters)]
                if valid_found:
                    page_babs[p] = valid_found[-1] # Use the last one found on the page
                    
        # Step 3: Find the first and last table page for each chapter
        first_table_page = {}
        last_table_page = {}
        for c in raw_chapters:
            num = c["num"]
            pages_for_num = [p for p, b in page_babs.items() if b == num]
            if pages_for_num:
                first_table_page[num] = min(pages_for_num)
                last_table_page[num] = max(pages_for_num)
            else:
                first_table_page[num] = None
                last_table_page[num] = None
                
        # Step 4: Determine cover start and end pages dynamically
        babs = []
        for idx, c in enumerate(raw_chapters):
            num = c["num"]
            
            # Start page calculation
            if num == 1:
                # For Bab 1, it starts 2 pages before its first table page
                f1 = first_table_page.get(1)
                if f1:
                    cover_start = max(30, f1 - 6) # Search back for the cover
                    # Scan backward from f1 to find cover
                    for p in range(f1 - 1, 30, -1):
                        text = pdf.pages[p - 1].extract_text()
                        if not text:
                            cover_start = p
                            continue
                        text_upper = text.upper()
                        if "STATISTIK KUNCI" in text_upper or "DAFTAR ISI" in text_upper or "KATA PENGANTAR" in text_upper:
                            cover_start = p + 1
                            break
                        cover_start = p
                else:
                    cover_start = 41 # Fallback
            else:
                # For Bab N, it starts exactly on the page after the last table page of Bab N-1
                prev_num = raw_chapters[idx - 1]["num"]
                prev_last = last_table_page.get(prev_num)
                if prev_last:
                    cover_start = prev_last + 1
                else:
                    # Fallback if previous chapter had no detected tables
                    cover_start = babs[-1]["end_page"] + 1
                    
            # End page calculation
            # It ends on the last table page of this Bab, or if next Bab has a start, the page before it.
            # But during this loop, we just store start_page first
            babs.append({
                "num": num,
                "title": c["title"],
                "start_page": cover_start
            })
            
        # Adjust end pages based on start pages of the next chapter
        babs.sort(key=lambda x: x["start_page"])
        for i in range(len(babs) - 1):
            babs[i]["end_page"] = babs[i+1]["start_page"] - 1
        babs[-1]["end_page"] = total_pages
        
        return babs

# Test it!
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
babs = parse_bps_toc_by_scanning(pdf_path)
print("=== COVER DETECTION SCANNING RESULTS ===")
for b in babs:
    print(b)
