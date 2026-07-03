import os
import sys
import json
import argparse
import re
import pdfplumber
from collections import Counter

def is_actual_page_number(s):
    try:
        val = int(s)
        if 2010 <= val <= 2030:
            return False
        if val > 600:
            return False
        return True
    except:
        return False

def parse_bps_toc(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        
        # Scan pages 10 to 35
        toc_lines = []
        for i in range(9, min(36, total_pages)):
            text = pdf.pages[i].extract_text()
            if not text:
                continue
            toc_lines.extend(text.split('\n'))
            
        # Combine multi-line chapter entries
        combined_chapter_lines = []
        i = 0
        while i < len(toc_lines):
            line = toc_lines[i].strip()
            if not line:
                i += 1
                continue
            starts_with_num = re.match(r'^(\d+)\.\s+', line)
            m_end = re.search(r'(\d+)$', line)
            ends_with_page = bool(m_end and is_actual_page_number(m_end.group(1)))
            
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
                    m_next_end = re.search(r'(\d+)$', next_line)
                    if m_next_end and is_actual_page_number(m_next_end.group(1)):
                        combined_line += " " + next_line
                        i = j
                        break
                    else:
                        combined_line += " " + next_line
                    j += 1
                combined_chapter_lines.append(combined_line)
            else:
                combined_chapter_lines.append(line)
            i += 1
            
        # Parse chapter titles and their printed start pages from TOC
        chapters = []
        for line in combined_chapter_lines:
            m_ch = re.search(r'^(\d+)\.\s+(.*?)\s*[\s\.]+\s*(\d+)$', line)
            if m_ch and is_actual_page_number(m_ch.group(3)):
                num = int(m_ch.group(1))
                title = m_ch.group(2).strip()
                printed_start = int(m_ch.group(3))
                if "/" in title:
                    title = title.split("/")[0].strip()
                title = title.title()
                title = re.sub(r'\bAnd\b', 'dan', title, flags=re.IGNORECASE)
                if 1 <= num <= 20 and not any(c['num'] == num for c in chapters):
                    chapters.append({
                        "num": num,
                        "title": f"Bab {num} - {title}",
                        "raw_start": printed_start
                    })
                    
        if not chapters:
            return []
            
        # Combine multi-line table entries
        combined_table_lines = []
        i = 0
        while i < len(toc_lines):
            line = toc_lines[i].strip()
            if not line:
                i += 1
                continue
            starts_with_table = re.match(r'^([1-9]|1[0-9])\.(\d+)(?:\.(\d+))?\b', line)
            m_end = re.search(r'(\d+)$', line)
            ends_with_page = bool(m_end and is_actual_page_number(m_end.group(1)))
            
            if starts_with_table and not ends_with_page:
                combined_line = line
                j = i + 1
                while j < len(toc_lines):
                    next_line = toc_lines[j].strip()
                    if not next_line:
                        j += 1
                        continue
                    if re.match(r'^([1-9]|1[0-9])\.(\d+)(?:\.(\d+))?\b', next_line) or re.match(r'^\d+\.\s+', next_line):
                        break
                    m_next_end = re.search(r'(\d+)$', next_line)
                    if m_next_end and is_actual_page_number(m_next_end.group(1)):
                        combined_line += " " + next_line
                        i = j
                        break
                    else:
                        combined_line += " " + next_line
                    j += 1
                combined_table_lines.append(combined_line)
            else:
                combined_table_lines.append(line)
            i += 1
            
        # Parse table printed pages
        raw_tables = []
        for line in combined_table_lines:
            m_t = re.search(r'^([1-9]|1[0-9])\.(\d+)(?:\.(\d+))?\s+.*?\.+\s*(\d+)$', line)
            if m_t and is_actual_page_number(m_t.group(4)):
                raw_tables.append({
                    "ch_num": int(m_t.group(1)),
                    "printed_page": int(m_t.group(4))
                })
                
        # Calculate dynamic offset using footer scanning
        offsets = []
        for p in range(40, min(80, total_pages)):
            text = pdf.pages[p - 1].extract_text()
            if not text:
                continue
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            if not lines:
                continue
            last_line = lines[-1]
            
            printed_page = None
            m_start = re.match(r'^(\d+)\b', last_line)
            if m_start:
                printed_page = int(m_start.group(1))
            else:
                m_end = re.search(r'\b(\d+)$', last_line)
                if m_end:
                    printed_page = int(m_end.group(1))
                    
            if printed_page and 1 <= printed_page < 150:
                offsets.append(p - printed_page)
                
        offset = Counter(offsets).most_common(1)[0][0] if offsets else 38
        
        # Group tables by their prefix (raw grouping)
        table_pages = {}
        for t in raw_tables:
            ch = t["ch_num"]
            page = t["printed_page"]
            if ch not in table_pages:
                table_pages[ch] = []
            table_pages[ch].append(page)
            
        # Validate and identify trusted TOC start pages (no typos)
        # S_C is trusted if F_C - S_C <= 8.
        trusted_starts = {}
        for c in chapters:
            num = c["num"]
            raw_s = c["raw_start"]
            
            # Find first table printed page for this chapter in raw grouping
            f_c = min(table_pages[num]) if (num in table_pages and table_pages[num]) else raw_s
            
            if num == 1:
                trusted_starts[1] = raw_s
            else:
                if f_c - raw_s <= 8:
                    trusted_starts[num] = raw_s
                    
        # Now re-group tables by filtering out outliers using trusted_starts
        filtered_table_pages = {}
        for t in raw_tables:
            ch = t["ch_num"]
            page = t["printed_page"]
            
            is_outlier = False
            for next_ch in range(ch + 1, 20):
                if next_ch in trusted_starts:
                    if page >= trusted_starts[next_ch]:
                        is_outlier = True
                        break
            if not is_outlier:
                if ch not in filtered_table_pages:
                    filtered_table_pages[ch] = []
                filtered_table_pages[ch].append(page)
                
        # Map chapter boundaries
        babs = []
        for idx, c in enumerate(chapters):
            num = c["num"]
            
            if num == 1:
                f1_pdf = (min(filtered_table_pages[1]) + offset) if (1 in filtered_table_pages and filtered_table_pages[1]) else 47
                cover_start = max(30, f1_pdf - 6)
            else:
                prev_num = chapters[idx - 1]["num"]
                if prev_num in filtered_table_pages and filtered_table_pages[prev_num]:
                    prev_last_printed = max(filtered_table_pages[prev_num])
                    cover_start = prev_last_printed + offset + 1
                else:
                    cover_start = babs[-1]["end_page"] + 1
                    
            if num in filtered_table_pages and filtered_table_pages[num]:
                last_printed = max(filtered_table_pages[num])
                cover_end = last_printed + offset
            else:
                cover_end = cover_start + 10
                
            babs.append({
                "num": num,
                "title": c["title"],
                "start_page": cover_start,
                "end_page": cover_end
            })
            
        # Adjust end pages to eliminate gaps
        babs.sort(key=lambda x: x["start_page"])
        for i in range(len(babs) - 1):
            babs[i]["end_page"] = babs[i+1]["start_page"] - 1
        babs[-1]["end_page"] = total_pages
        
        return babs

def get_toc_fallback(pdf_path):
    """Parser TOC khusus untuk publikasi BPS tahun 2018 dan 2019.
    Format TOC-nya berbeda: nomor bab tanpa titik (e.g., '1 Geografi'),
    banyak artefak single-char noise dari watermark PDF.
    """
    import pdfplumber, re
    from collections import Counter
    
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        
        # --- Step 1: Kumpulkan teks TOC dari halaman 5-14 (area Daftar Isi) ---
        toc_lines = []
        for i in range(5, 15):
            if i >= total_pages:
                break
            text = pdf.pages[i].extract_text()
            if not text:
                continue
            for line in text.split('\n'):
                line = line.strip()
                # Buang noise: baris dengan 1 karakter saja, atau header/footer
                if len(line) <= 2:
                    continue
                if any(skip in line.lower() for skip in ['daftar isi', 'daftar tabel', 'contents', 'list of table', 'tasikmalaya in figures', 'tasikmalaya dalam angka', 'halaman', 'page', 'penjelasan umum', 'explanatory']):
                    continue
                toc_lines.append(line)
        
        # --- Step 2: Gabungkan baris yang terpotong (multi-line chapter entries) ---
        # Bab seperti "3 Kependudukan dan Ketenagakerjaan/Population and"
        # dilanjutkan di baris berikutnya "Employment ...... 23"
        combined_lines = []
        i = 0
        while i < len(toc_lines):
            line = toc_lines[i]
            # Cek apakah ini awal entry bab utama (dimulai angka 1-13 diikuti huruf kapital)
            m_start = re.match(r'^(\d{1,2})\s+([A-Z])', line)
            if m_start:
                num_candidate = int(m_start.group(1))
                # Cek apakah ini sub-bab (format "N N ..." dimana digit kedua langsung mengikuti)
                is_subbab = bool(re.match(r'^\d{1,2}\s+\d', line))
                
                if not is_subbab and 1 <= num_candidate <= 20:
                    # Cek apakah baris ini sudah lengkap (berakhir dengan angka halaman)
                    has_page = bool(re.search(r'\d{1,3}\s*$', line)) and bool(re.search(r'(?:\.{2,}|\s{3,})\s*\d{1,3}\s*$', line))
                    
                    if not has_page:
                        # Gabungkan dengan baris-baris berikutnya sampai menemukan nomor halaman
                        combined = line
                        j = i + 1
                        while j < len(toc_lines) and j <= i + 3:
                            next_line = toc_lines[j]
                            # Jika baris berikutnya dimulai dengan angka bab baru, berhenti
                            if re.match(r'^\d{1,2}\s+[A-Z]', next_line) and not re.match(r'^\d{1,2}\s+\d', next_line):
                                break
                            combined += " " + next_line
                            if re.search(r'\d{1,3}\s*$', next_line):
                                break
                            j += 1
                        combined_lines.append(combined)
                        i = j + 1
                        continue
            
            combined_lines.append(line)
            i += 1
        
        # --- Step 3: Parse bab utama dari combined lines ---
        chapters = []
        for line in combined_lines:
            # Cocokkan: "1 Geografi dan Iklim/Geography and Climate .... 1"
            m = re.match(r'^(\d{1,2})\s+([A-Z][A-Za-z].*?)(?:\.{2,}|\s{3,})\s*(\d{1,3})\s*$', line)
            if m:
                num = int(m.group(1))
                title_raw = m.group(2).strip()
                page = int(m.group(3))
                
                # Bersihkan judul: ambil sebelum '/' (bahasa Indonesia saja)
                title = title_raw.split('/')[0].strip()
                # Hapus artefak single char di tengah judul
                title = re.sub(r'\s+[a-z]\s+', ' ', title)
                title = re.sub(r'\s{2,}', ' ', title).strip()
                
                if 1 <= num <= 20 and 1 <= page <= 500 and not any(c['num'] == num for c in chapters):
                    chapters.append({
                        'num': num,
                        'title': f'Bab {num} - {title}',
                        'raw_start': page
                    })
        
        # Juga coba pattern tanpa titik-titik panjang (judul dengan spasi biasa + nomor halaman)
        for line in combined_lines:
            m = re.match(r'^(\d{1,2})\s+([A-Z][A-Za-z].*?)\s+(\d{1,3})\s*$', line)
            if m:
                num = int(m.group(1))
                title_raw = m.group(2).strip()
                page = int(m.group(3))
                title = title_raw.split('/')[0].strip()
                title = re.sub(r'\s+[a-z]\s+', ' ', title)
                title = re.sub(r'\s{2,}', ' ', title).strip()
                
                if 1 <= num <= 20 and 1 <= page <= 500 and not any(c['num'] == num for c in chapters):
                    # Pastikan ini bukan sub-bab (sub-bab formatnya "N N" bukan "N Judul")
                    if not re.match(r'^\d{1,2}\s+\d', line):
                        chapters.append({
                            'num': num,
                            'title': f'Bab {num} - {title}',
                            'raw_start': page
                        })
        
        if not chapters:
            return []
        
        chapters.sort(key=lambda x: x['num'])
        
        # --- Step 3: Hitung offset (selisih antara nomor halaman PDF vs printed) ---
        # Cari halaman yang menampilkan nomor halaman kecil di footer
        offsets = []
        for p in range(30, min(60, total_pages)):
            text = pdf.pages[p].extract_text()
            if not text:
                continue
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            if not lines:
                continue
            # Cek baris terakhir untuk nomor halaman printed
            for check_line in lines[-3:]:
                m_page = re.search(r'\b(\d{1,3})\s*$', check_line)
                if m_page:
                    printed = int(m_page.group(1))
                    if 1 <= printed <= 300:
                        offsets.append(p - printed)
        
        if offsets:
            offset = Counter(offsets).most_common(1)[0][0]
        else:
            offset = 38  # Default fallback
        
        # --- Step 4: Bangun hasil bab dengan boundaries ---
        babs = []
        for i, c in enumerate(chapters):
            start = c['raw_start'] + offset
            if i + 1 < len(chapters):
                end = chapters[i + 1]['raw_start'] + offset - 1
            else:
                end = total_pages
            
            babs.append({
                'num': c['num'],
                'title': c['title'],
                'start_page': max(1, start),
                'end_page': min(total_pages, end)
            })
        
        return babs

def get_toc(pdf_path):
    try:
        import os
        filename = os.path.basename(pdf_path)
        # KHUSUS 2018 & 2019: Menggunakan parser fallback terpisah agar tidak merusak yang sudah berjalan di 2020-2026
        if "2018" in filename or "2019" in filename:
            babs_fallback = get_toc_fallback(pdf_path)
            if babs_fallback:
                return babs_fallback

        babs = parse_bps_toc(pdf_path)
        if babs:
            return babs
    except Exception as e:
        print(f"Error extracting dynamic TOC: {e}")
        
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
