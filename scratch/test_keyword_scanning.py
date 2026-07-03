import pdfplumber
import re
import os

def detect_chapters_by_keywords(pdf_path):
    # Keywords for each chapter
    chapter_keywords = {
        1: ["GEOGRAFI", "GEOGRAPHY", "IKLIM", "CLIMATE"],
        2: ["PEMERINTAHAN", "GOVERNMENT"],
        3: ["PENDUDUK", "POPULATION", "KETENAGAKERJAAN", "EMPLOYMENT"],
        4: ["SOSIAL", "SOCIAL", "KESEJAHTERAAN", "WELFARE"],
        5: ["PERTANIAN", "AGRICULTURE", "KEHUTANAN", "FORESTRY", "PETERNAKAN", "LIVESTOCK", "PERIKANAN", "FISHERY"],
        6: ["INDUSTRI", "INDUSTRY", "PERTAMBANGAN", "MINING", "ENERGI", "ENERGY"],
        7: ["PARIWISATA", "TOURISM"],
        8: ["TRANSPORTASI", "TRANSPORTATION", "KOMUNIKASI", "COMMUNICATION"],
        9: ["PERBANKAN", "BANKING", "KOPERASI", "COOPERATIVE", "HARGA", "PRICES"],
        10: ["PENGELUARAN", "EXPENDITURE"],
        11: ["PERDAGANGAN", "TRADE"],
        12: ["NERACA", "ACCOUNTS"],
        13: ["PERBANDINGAN", "COMPARISON"]
    }
    
    # We want to map each page to a chapter
    page_to_chapter = {}
    
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        
        # We scan from page 35 to the end of the PDF
        for p in range(35, total_pages + 1):
            text = pdf.pages[p - 1].extract_text()
            if not text:
                continue
                
            text_upper = text.upper()
            
            # Count keyword matches for each chapter
            matches = {}
            for ch_num, kw_list in chapter_keywords.items():
                count = 0
                for kw in kw_list:
                    # Search as a word or substring
                    count += len(re.findall(r'\b' + re.escape(kw) + r'\b', text_upper))
                if count > 0:
                    matches[ch_num] = count
                    
            if matches:
                # Assign to the chapter with the maximum keyword count
                best_ch = max(matches, key=matches.get)
                page_to_chapter[p] = best_ch
                
    # Step 2: For each chapter, find its continuous page block
    babs = []
    chapter_titles = {
        1: "Geografi Dan Iklim",
        2: "Pemerintahan",
        3: "Penduduk Dan Ketenagakerjaan",
        4: "Sosial Dan Kesejahteraan Rakyat",
        5: "Pertanian, Kehutanan, Peternakan, Dan Perikanan",
        6: "Industri, Pertambangan, Dan Energi",
        7: "Pariwisata",
        8: "Transportasi Dan Komunikasi",
        9: "Perbankan, Koperasi, Dan Harga-Harga",
        10: "Pengeluaran Penduduk",
        11: "Perdagangan",
        12: "Sistem Neraca Regional",
        13: "Perbandingan Antar Kabupaten/Kota"
    }
    
    for ch_num in range(1, 14):
        pages = [p for p, ch in page_to_chapter.items() if ch == ch_num]
        if pages:
            # We determine the start and end based on the min and max page
            start_pg = min(pages)
            
            # The cover page of chapter N is typically 1 or 2 pages before the first content page.
            # Let's adjust the start_page to include the cover page:
            # For Bab 1, it starts at PDF page 41.
            # For other Babs, it starts on the page after the previous chapter's last page.
            babs.append({
                "num": ch_num,
                "title": f"Bab {ch_num} - {chapter_titles[ch_num]}",
                "first_content_page": start_pg,
                "last_content_page": max(pages)
            })
            
    # Step 3: Determine the final cover start and end pages
    final_babs = []
    for idx, b in enumerate(babs):
        num = b["num"]
        
        if num == 1:
            start_page = 41
        else:
            # It starts immediately after the previous chapter's last content page
            start_page = babs[idx - 1]["last_content_page"] + 1
            
        final_babs.append({
            "num": num,
            "title": b["title"],
            "start_page": start_page,
            "end_page": b["last_content_page"]
        })
        
    # Adjust end pages so there are no gaps
    for i in range(len(final_babs) - 1):
        final_babs[i]["end_page"] = final_babs[i+1]["start_page"] - 1
    final_babs[-1]["end_page"] = total_pages
    
    return final_babs

# Test it on 2024 PDF!
pdf_path = r"d:\Kuliah\KP\project_bps_tasik\backend\uploads\kabupaten-tasikmalaya-dalam-angka-2024.pdf"
babs = detect_chapters_by_keywords(pdf_path)
print("=== KEYWORD BASED DETECTION RESULTS ===")
for b in babs:
    print(b)
