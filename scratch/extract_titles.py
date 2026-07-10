"""Extract full table titles from PDF using pdfplumber."""
import os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))
import models
from database import SessionLocal
import pdfplumber

pdf_path = r'C:\Users\MyBook Z Series\BPS_Data\uploads\kabupaten-tasikmalaya-dalam-angka-2026.pdf'

db = SessionLocal()
tables = db.query(models.ExtractedTable).filter(
    models.ExtractedTable.document_id == 85
).order_by(models.ExtractedTable.id).all()

def extract_page_number(csv_path):
    if not csv_path: return None
    fn = os.path.basename(csv_path)
    m = re.search(r'Hal\s*(\d+)', fn)
    return int(m.group(1)) if m else None

def find_title_on_page(page, table_num):
    """Look for table_title + table_num pattern on consecutive lines."""
    text = page.extract_text()
    lines = text.split('\n')
    
    # Find the line with just the table number
    num_idx = None
    for i, line in enumerate(lines):
        if line.strip() == table_num:
            num_idx = i
            break
    
    if num_idx is not None and num_idx > 0:
        # The line before should contain "Tabel ..."
        title_line = lines[num_idx - 1].strip()
        if 'Tabel' in title_line:
            # Remove "Tabel" prefix and combine with number
            title_part = re.sub(r'^Tabel\s*', '', title_line)
            full_title = f'Tabel {table_num} - {title_part}'
            full_title = re.sub(r'\s+', ' ', full_title).strip()
            # Remove trailing page numbers
            full_title = re.sub(r'\s+\d+\s*$', '', full_title)
            return full_title

    # Fallback: look for "Tabel X.X.X" pattern
    for i, line in enumerate(lines):
        m = re.match(r'^Tabel\s+([\d.]+)\s*[–\-—]\s*(.*)', line.strip())
        if m and m.group(1).replace('.','') == table_num.replace('.',''):
            title = f'Tabel {m.group(1)} - {m.group(2)}'
            title = re.sub(r'\s+', ' ', title).strip()
            title = re.sub(r'\s+\d+\s*$', '', title)
            return title

    return None

pdf = pdfplumber.open(pdf_path)
print(f'PDF: {len(pdf.pages)} pages')

for t in tables:
    name = t.table_name or ''
    # Strip year suffix for comparison
    clean_name = re.sub(r',\s*\d{4}$', '', name)
    
    page_num = extract_page_number(t.csv_path)
    if not page_num:
        continue

    m = re.match(r'Tabel\s+([\d.]+)', name)
    table_num = m.group(1) if m else ''
    
    # Search on this page and nearby pages
    found_title = None
    for pn in [page_num, page_num - 1, page_num - 2, page_num + 1]:
        if 1 <= pn <= len(pdf.pages):
            page = pdf.pages[pn - 1]
            title = find_title_on_page(page, table_num)
            if title and len(title) > len(clean_name) and title != clean_name:
                found_title = title
                break
    
    if found_title:
        print(f'id={t.id:5d} (Hal {page_num})')
        print(f'  OLD: {clean_name}')
        print(f'  NEW: {found_title}')
        print()
    else:
        print(f'id={t.id:5d} (Hal {page_num}) NOT FOUND')
        print(f'  OLD: {clean_name}')
        print()

pdf.close()
db.close()
