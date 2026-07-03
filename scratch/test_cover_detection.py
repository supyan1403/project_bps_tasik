import pdfplumber
import re
import os

def parse_bps_toc_scanning(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        
        # Step 1: Scan Table of Contents
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
        page_babs = {}
        for p in range(30, total_pages + 1):
            text = pdf.pages[p - 1].extract_text()
            if not text:
                continue
                
            babs_found = []
            for m in re.finditer(r'\b(?:Tabel|Table)\s*([1-9]\d*)\b', text, re.IGNORECASE):
                babs_found.append(int(m.group(1)))
                
            for m in re.finditer(r'\b([1-9]|1[0-9])\.(\d+)(?:\.(\d+))?\b', text):
                part1 = int(m.group(1))
                part2 = int(m.group(2))
                part3 = int(m.group(3)) if m.group(3) else None
                if part2 < 50 and (part3 is None or part3 < 50):
                    babs_found.append(part1)
                    
            if babs_found:
                valid_found = [b for b in babs_found if any(c['num'] == b for c in raw_chapters)]
                if valid_found:
                    page_babs[p] = valid_found[-1]
                    
        # Step 3: Find first and last table pages
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
                
        # Step 4: Map chapter boundaries
        babs = []
        for idx, c in enumerate(raw_chapters):
            num = c["num"]
            
            if num == 1:
                f1 = first_table_page.get(1)
                cover_start = max(30, f1 - 2) if f1 else 41
                # If page cover_start - 1 is also blank/watermark only, we can adjust.
                # But max(30, f1 - 2) typically gives exactly page 41 or 40.
            else:
                prev_num = raw_chapters[idx - 1]["num"]
                prev_last = last_table_page.get(prev_num)
                if prev_last:
                    cover_start = prev_last + 1
                else:
                    cover_start = babs[-1]["start_page"] + 10 # Fallback
                    
            babs.append({
                "num": num,
                "title": c["title"],
                "start_page": cover_start
            })
            
        babs.sort(key=lambda x: x["start_page"])
        for i in range(len(babs) - 1):
            babs[i]["end_page"] = babs[i+1]["start_page"] - 1
        babs[-1]["end_page"] = total_pages
        
        return babs

# Test it!
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
babs = parse_bps_toc_scanning(pdf_path)
print("=== SCANNING TOC RESULTS ===")
for b in babs:
    print(b)
