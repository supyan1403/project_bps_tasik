import pdfplumber
import re
import os

pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
with pdfplumber.open(pdf_path) as pdf:
    total_pages = len(pdf.pages)
    
    # Advanced table detection for each page
    for p in range(30, total_pages + 1):
        text = pdf.pages[p - 1].extract_text()
        if not text: continue
        
        # Find table patterns like "1.1.1" or "Tabel 1.1.1" or "10.2"
        babs_found = []
        
        # Pattern 1: Word Tabel / Table followed by a number
        for m in re.finditer(r'\b(?:Tabel|Table)\s*([1-9]\d*)\b', text, re.IGNORECASE):
            babs_found.append(int(m.group(1)))
            
        # Pattern 2: Standalone 1.1.1 or 10.1 patterns
        for m in re.finditer(r'\b([1-9]|1[0-9])\.(\d+)(?:\.(\d+))?\b', text):
            # Check if it looks like a table number (not a year or decimal)
            part1 = int(m.group(1))
            part2 = int(m.group(2))
            part3 = int(m.group(3)) if m.group(3) else None
            
            # Table numbers typically have part2 < 50 and part3 < 50
            if part2 < 50 and (part3 is None or part3 < 50):
                # Also exclude common patterns like "1. Untuk", "2024. 1", etc.
                # If part3 is None, it could be a section header, but in BPS, table headers are like 10.1 or 6.1.
                babs_found.append(part1)
                
        if babs_found:
            # Print page and unique Bab numbers found
            print(f"Page {p} contains Bab numbers: {list(set(babs_found))}")
