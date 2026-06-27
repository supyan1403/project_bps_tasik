import pdfplumber
import re

def test_title_extraction(pdf_path, page_num):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num - 1]
        
        # Filter watermark
        filtered_page = page.filter(lambda obj: obj.get("object_type") != "char" or obj.get("size", 0) < 15)
        
        tables = filtered_page.find_tables()
        if not tables:
            print(f"No tables on page {page_num}")
            return
            
        # Get all words on the page to form lines
        words = filtered_page.extract_words()
        
        for idx, table_obj in enumerate(tables):
            bbox = table_obj.bbox
            print(f"\nTable {idx+1} bbox: {bbox}")
            
            # Find words above this table (y1 <= table_obj.bbox[1])
            # We want the text closest to the table. Let's look at the area above the table.
            # Say, from top=0 to table's top.
            words_above = [w for w in words if w['bottom'] <= bbox[1] + 5] # +5 for margin
            
            # Group words by lines (approximate same top)
            lines = {}
            for w in words_above:
                # Group by top coordinate (rounded to avoid floating point issues)
                top_rounded = round(w['top'])
                if top_rounded not in lines:
                    lines[top_rounded] = []
                lines[top_rounded].append(w)
                
            # Sort lines top to bottom
            sorted_tops = sorted(lines.keys())
            
            # Combine words into strings
            text_lines = []
            for t in sorted_tops:
                # sort words by left to right
                sorted_words = sorted(lines[t], key=lambda x: x['x0'])
                line_text = " ".join([w['text'] for w in sorted_words])
                text_lines.append(line_text)
                
            print(f"Lines above table:")
            for line in text_lines[-5:]: # Print last 5 lines above table
                print(f"  {line}")
                
            # Regex to find Tabel number
            table_num = None
            # Search from bottom-up (closest to table)
            for line in reversed(text_lines):
                match = re.search(r'(?:Tabel|Table)\s*(\d+\.\d+(?:\.\d+[a-zA-Z]?)?)', line, re.IGNORECASE)
                if match:
                    table_num = match.group(1)
                    break
            
            print(f"Extracted Table Number: {table_num}")

test_title_extraction('kabupaten-tasikmalaya-dalam-angka-2026.pdf', 97) # Table 4.1.1 (first page)
print("-" * 50)
test_title_extraction('kabupaten-tasikmalaya-dalam-angka-2026.pdf', 98) # Table 4.1.1 (Lanjutan)
