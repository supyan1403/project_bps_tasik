import pdfplumber
import re
import os

def parse_bps_toc(pdf_path):
    chapters = []
    first_table_page = None
    first_table_printed_num = None
    
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        
        # Step 1: Scan first 30 pages to find the Table of Contents and extract printed page numbers
        toc_lines = []
        for i in range(5, min(30, total_pages)):
            text = pdf.pages[i].extract_text()
            if not text:
                continue
            if "DAFTAR ISI" in text.upper() or "CONTENTS" in text.upper():
                toc_lines.extend(text.split('\n'))
                
        # Parse chapter entries from TOC text
        # e.g., "1. Geografi dan Iklim/Geoagraphy and Climate ..................................................... 1"
        # e.g., "1. Geografi dan Iklim ..................................................... 1"
        raw_chapters = []
        for line in toc_lines:
            line = line.strip()
            # Match number at start, then some text, then dots, then page number at end
            match = re.search(r'^(\d+)\.\s+(.*?)\.+\s*(\d+)$', line)
            if match:
                bab_num = int(match.group(1))
                title_part = match.group(2).strip()
                printed_page = int(match.group(3))
                
                # Clean title_part (take Indonesian part before slash if exists)
                if "/" in title_part:
                    title_part = title_part.split("/")[0].strip()
                # Remove English only trailing words or clean capitalization
                title_part = title_part.title()
                
                # Check for duplicate bab numbers
                if 1 <= bab_num <= 20 and not any(c['num'] == bab_num for c in raw_chapters):
                    raw_chapters.append({
                        "num": bab_num,
                        "title": f"Bab {bab_num} - {title_part}",
                        "printed_page": printed_page
                    })
                    
        # Step 2: Find the PDF page of the first table (e.g. 1.1.1) to calculate the offset
        # We search pages 30 to 60 for "1.1.1" table title
        for i in range(30, min(65, total_pages)):
            text = pdf.pages[i].extract_text()
            if not text:
                continue
            if "1.1.1" in text or "Tabel 1.1.1" in text or "Table 1.1.1" in text:
                # We found Table 1.1.1 on PDF Page i+1
                # Let's find what page Table 1.1.1 is printed on in the TOC
                # On page 17 of 2024 PDF: "1.1.1 Luas Daerah ... 9"
                # Let's search TOC lines for 1.1.1
                for line in toc_lines:
                    if "1.1.1" in line:
                        m = re.search(r'1\.1\.1.*\.+\s*(\d+)$', line)
                        if m:
                            first_table_printed_num = int(m.group(1))
                            first_table_page = i + 1
                            break
                if first_table_page:
                    break
                    
        if first_table_page and first_table_printed_num:
            offset = first_table_page - first_table_printed_num
            print(f"Calculated offset: {offset} (Table 1.1.1 found on PDF page {first_table_page}, printed page {first_table_printed_num})")
        else:
            # Fallback offset: check where Bab 1 printed page (usually 1) maps.
            # Usually Bab 1 is on page 41 or 40.
            # Let's search for "GEOGRAFI" in pages 38-45
            offset = 40 # Default fallback
            for i in range(35, 45):
                text = pdf.pages[i].extract_text()
                if text and "GEOGRAFI" in text.upper() and "ULASAN" in text.upper():
                    offset = i + 1 - 1 # Since Bab 1 starts at printed page 1
                    break
            print(f"Fallback offset calculated: {offset}")
            
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
        print(f"\n=== Testing parser on {f} ===")
        babs = parse_bps_toc(path)
        for b in babs:
            print(b)
