import pdfplumber
import re
import os

def parse_bps_toc_v2(pdf_path):
    chapters = []
    
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        
        # Step 1: Scan first 35 pages to find the Table of Contents pages
        toc_lines = []
        for i in range(5, min(35, total_pages)):
            text = pdf.pages[i].extract_text()
            if not text:
                continue
            if "DAFTAR ISI" in text.upper() or "CONTENTS" in text.upper():
                toc_lines.extend(text.split('\n'))
                
        # Combine multi-line entries in TOC
        # If a line starts with a number (e.g. "5. ") but does not end with a number,
        # and the next line ends with a number, we combine them.
        combined_lines = []
        i = 0
        while i < len(toc_lines):
            line = toc_lines[i].strip()
            if not line:
                i += 1
                continue
                
            # Check if this line starts with a chapter number (e.g., "5. " or "10. ")
            starts_with_num = re.match(r'^(\d+)\.\s+', line)
            ends_with_page = re.search(r'\d+$', line)
            
            if starts_with_num and not ends_with_page:
                # Try to look ahead and find the continuation line that ends with a page number
                combined_line = line
                j = i + 1
                while j < len(toc_lines):
                    next_line = toc_lines[j].strip()
                    if not next_line:
                        j += 1
                        continue
                    # If next line starts with a new chapter number, stop combining
                    if re.match(r'^\d+\.\s+', next_line):
                        break
                    # If next line ends with page number, combine it and stop
                    if re.search(r'\d+$', next_line):
                        combined_line += " " + next_line
                        i = j # Skip to this line
                        break
                    else:
                        # Otherwise just append it and keep looking
                        combined_line += " " + next_line
                    j += 1
                combined_lines.append(combined_line)
            else:
                combined_lines.append(line)
            i += 1
            
        # Parse chapter entries from combined lines
        raw_chapters = []
        for line in combined_lines:
            # Match number at start, then some text, then optional dots/spaces, then page number at end
            match = re.search(r'^(\d+)\.\s+(.*?)\s*[\s\.]+\s*(\d+)$', line)
            if match:
                bab_num = int(match.group(1))
                title_part = match.group(2).strip()
                printed_page = int(match.group(3))
                
                # Clean title_part (take Indonesian part before slash if exists)
                if "/" in title_part:
                    title_part = title_part.split("/")[0].strip()
                title_part = title_part.title()
                
                # Remove common garbage or English words in title
                title_part = re.sub(r'\bAnd\b', 'dan', title_part, flags=re.IGNORECASE)
                
                if 1 <= bab_num <= 20 and not any(c['num'] == bab_num for c in raw_chapters):
                    raw_chapters.append({
                        "num": bab_num,
                        "title": f"Bab {bab_num} - {title_part}",
                        "printed_page": printed_page
                    })
                    
        # Step 2: Fallback offset calculation.
        # Find where Bab 3 starts (since Bab 3 is always at the same printed page e.g. 35)
        # Or Bab 1 starts. Let's search for "GEOGRAFI" in pages 38-45 to find the exact PDF page of Bab 1.
        offset = 40 # Default fallback
        for pg_idx in range(35, 45):
            text = pdf.pages[pg_idx].extract_text()
            if text and "GEOGRAFI" in text.upper() and "ULASAN" in text.upper():
                offset = pg_idx + 1 - 1 # Since Bab 1 starts at printed page 1
                break
        print(f"Calculated offset: {offset}")
            
        # Step 3: Apply offset to raw_chapters to get PDF start and end pages
        babs = []
        for c in raw_chapters:
            start_pdf = c["printed_page"] + offset
            babs.append({
                "title": c["title"],
                "start_page": start_pdf
            })
            
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
        print(f"\n=== Testing parser v2 on {f} ===")
        babs = parse_bps_toc_v2(path)
        for b in babs:
            print(b)
