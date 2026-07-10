import pdfplumber, re

pdf_path = 'backend/uploads/kabupaten-tasikmalaya-dalam-angka-2026.pdf'
with pdfplumber.open(pdf_path) as pdf:
    for i in range(9, min(25, len(pdf.pages))):
        text = pdf.pages[i].extract_text()
        if not text:
            continue
        for line in text.split('\n'):
            line_s = line.strip()
            if not line_s or len(line_s) < 10:
                continue
            # Check for lines that look like table entries (have number.number pattern)
            if re.search(r'\d+\.\d+', line_s):
                # Check various patterns
                m1 = re.match(r'^(\d+\.\d+(?:\.\d+)?)\s+(.*?)\s*[\.\s]+\s*(\d+)\s*$', line_s)
                m2 = re.match(r'^(\d+\.\d+(?:\.\d+)?)\s+(.*?)\s+(\d+)\s*$', line_s)
                print(f'Page {i+1}: [{line_s[:100]}]')
                print(f'  match1={bool(m1)} match2={bool(m2)}')
                if m1 or m2:
                    print(f'  num={m1.group(1) if m1 else m2.group(1)} desc={m1.group(2)[:60] if m1 else m2.group(2)[:60]} page={m1.group(3) if m1 else m2.group(3)}')
                print()
