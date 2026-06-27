import os
import sys
import json
import argparse
from pypdf import PdfReader

# Fallback default bab ranges for Tasikmalaya Dalam Angka:
DEFAULT_BABS = [
    {"title": "Bab 1 - Geografi dan Iklim", "start_page": 42, "end_page": 54},
    {"title": "Bab 2 - Pemerintahan", "start_page": 54, "end_page": 75},
    {"title": "Bab 3 - Kependudukan", "start_page": 75, "end_page": 93},
    {"title": "Bab 4 - Ketenagakerjaan", "start_page": 93, "end_page": 179},
    {"title": "Bab 5 - Sosial dan Kesejahteraan Rakyat", "start_page": 179, "end_page": 288},
    {"title": "Bab 6 - Pertanian", "start_page": 288, "end_page": 310},
    {"title": "Bab 7 - Industri, Pertambangan, Energi, dan Konstruksi", "start_page": 310, "end_page": 325},
    {"title": "Bab 8 - Pariwisata, Transportasi, dan Komunikasi", "start_page": 325, "end_page": 336},
    {"title": "Bab 9 - Perbankan, Koperasi, dan Perdagangan", "start_page": 336, "end_page": 348},
    {"title": "Bab 10 - Pengeluaran Penduduk", "start_page": 348, "end_page": 356},
    {"title": "Bab 11 - Pendapatan Regional", "start_page": 356, "end_page": 368}
]

def extract_from_outline(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        outline = reader.outline
        if not outline:
            return None
        
        babs = []
        
        def parse_item(item):
            if isinstance(item, list):
                for sub in item:
                    parse_item(sub)
            else:
                title = item.title
                page_num = reader.get_destination_page_number(item) + 1  # 1-indexed
                title_lower = title.lower()
                import re
                # Match title that starts with Bab or Chapter followed by spaces and numbers
                if re.match(r'^(bab|chapter)\s+\d+', title_lower):
                    babs.append({"title": title, "start_page": page_num})
                    
        parse_item(outline)
        
        if not babs:
            return None
            
        # Sort by page number
        babs.sort(key=lambda x: x["start_page"])
        
        # Calculate end_page for each bab
        for i in range(len(babs) - 1):
            babs[i]["end_page"] = babs[i+1]["start_page"]
            
        total_pages = len(reader.pages)
        babs[-1]["end_page"] = total_pages
        
        return babs
    except Exception as e:
        print(f"Error parsing outline: {e}")
        return None

def extract_from_text(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        babs = []
        import re
        
        for idx in range(10, min(40, len(reader.pages))):
            text = reader.pages[idx].extract_text()
            if not text:
                continue
            lines = text.split('\n')
            for line in lines:
                line_strip = line.strip()
                match = re.match(r'^(BAB|Bab)\s+(\d+|[IVXLCDM]+)\s+(.*)', line_strip)
                if match:
                    title = f"Bab {match.group(2)} - {match.group(3).strip()}"
                    if not any(b["title"].startswith(f"Bab {match.group(2)}") for b in babs):
                        babs.append({"title": title, "start_page": idx + 1})
                        
        if not babs:
            return None
            
        babs.sort(key=lambda x: x["start_page"])
        for i in range(len(babs) - 1):
            babs[i]["end_page"] = babs[i+1]["start_page"]
        babs[-1]["end_page"] = len(reader.pages)
        return babs
    except Exception as e:
        print(f"Error parsing text: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Extract TOC from BPS PDF")
    parser.add_argument("--pdf", required=True, help="Path to PDF file")
    parser.add_argument("--output_dir", required=True, help="Directory to save toc.json")
    args = parser.parse_args()
    
    os.makedirs(args.output_dir, exist_ok=True)
    
    babs = extract_from_outline(args.pdf)
    if not babs:
        print("Outline not found or empty. Trying text search...")
        babs = extract_from_text(args.pdf)
        
    if not babs:
        print("Could not auto-detect chapters. Using default fallback ranges...")
        babs = DEFAULT_BABS
        
    output_path = os.path.join(args.output_dir, "toc.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(babs, f, indent=4)
    print(f"TOC saved to {output_path}")

if __name__ == "__main__":
    main()
