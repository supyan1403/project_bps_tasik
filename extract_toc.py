import os
import sys
import json
import argparse
import re
import pdfplumber
from pypdf import PdfReader

def extract_toc_with_plumber(pdf_path):
    try:
        babs = []
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            # Skip first 30 pages to avoid "Tanda-tanda" / "Explanatory Notes"
            start_search_page = 30
            for i in range(start_search_page, total_pages):
                page = pdf.pages[i]
                text = page.extract_text()
                if not text: continue
                lines = [l.strip() for l in text.split('\n') if l.strip()]
                if len(lines) < 60:
                    found_bab = False
                    bab_num = None
                    bab_title = ""
                    for line_idx, line in enumerate(lines):
                        # Pattern: "1. GEOGRAFI DAN IKLIM"
                        m_num_title = re.match(r'^(\d+|[IVXLCDM]+)\.\s+([A-Z\s]{3,})', line)
                        if m_num_title:
                            bab_num = m_num_title.group(1)
                            bab_title = m_num_title.group(2).strip()
                            found_bab = True
                            break
                        # Pattern: "BAB 1"
                        m_bab = re.match(r'^BAB\s+(\d+|[IVXLCDM]+)', line, re.IGNORECASE)
                        if m_bab:
                            bab_num = m_bab.group(1)
                            remaining = line[m_bab.end():].strip()
                            if remaining:
                                bab_title = re.sub(r'^[\s\.\-:]+', '', remaining).strip()
                            elif line_idx + 1 < len(lines):
                                next_line = lines[line_idx+1]
                                if len(next_line) < 100 and not re.match(r'^(BAB|CHAPTER)', next_line, re.IGNORECASE):
                                    bab_title = next_line
                            found_bab = True
                            break
                    if found_bab and bab_num:
                        try:
                            bab_num_int = int(bab_num)
                            if bab_num_int > 50: continue
                            bab_num = str(bab_num_int)
                        except ValueError: pass
                        bab_title = re.sub(r'^(BAB|CHAPTER)\s+.*', '', bab_title, flags=re.IGNORECASE).strip()
                        bab_title = bab_title.title()
                        if not bab_title: bab_title = "Lainnya"
                        title = f"Bab {bab_num} - {bab_title}"
                        if not any(b["title"].startswith(f"Bab {bab_num} -") for b in babs):
                            babs.append({"title": title, "start_page": i + 1})
            if not babs: return None
            babs.sort(key=lambda x: x["start_page"])
            for i in range(len(babs) - 1):
                babs[i]["end_page"] = babs[i+1]["start_page"] - 1
            babs[-1]["end_page"] = total_pages
            return babs
    except Exception as e:
        print(f"Error with pdfplumber: {e}")
        return None

def extract_from_outline(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        outline = reader.outline
        if not outline: return None
        babs = []
        def parse_item(item):
            if isinstance(item, list):
                for sub in item: parse_item(sub)
            else:
                title = item.title
                page_num = reader.get_destination_page_number(item) + 1
                if re.match(r'^(bab|chapter)\s+(\d+)', title.lower()) or re.match(r'^(\d+)\.', title):
                    babs.append({"title": title, "start_page": page_num})
        parse_item(outline)
        if not babs: return None
        babs.sort(key=lambda x: x["start_page"])
        for i in range(len(babs) - 1):
            babs[i]["end_page"] = babs[i+1]["start_page"] - 1
        babs[-1]["end_page"] = len(reader.pages)
        return babs
    except: return None

def get_toc(pdf_path):
    babs = extract_toc_with_plumber(pdf_path)
    if babs: return babs
    babs = extract_from_outline(pdf_path)
    if babs: return babs
    print("Could not auto-detect chapters.")
    return []

def main():
    parser = argparse.ArgumentParser(description="Extract TOC from BPS PDF")
    parser.add_argument("--pdf", required=True, help="Path to PDF file")
    parser.add_argument("--output_dir", required=True, help="Directory to save toc.json")
    args = parser.parse_args()
    os.makedirs(args.output_dir, exist_ok=True)
    babs = get_toc(args.pdf)
    output_path = os.path.join(args.output_dir, "toc.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(babs, f, indent=4)
    print(f"TOC saved to {output_path}")

if __name__ == "__main__":
    main()
