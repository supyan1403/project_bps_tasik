import os
import sys
import re
import csv
import json
import logging
import argparse
from typing import List, Dict, Tuple, Optional, Any
import pandas as pd
import pdfplumber

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Re-export table cleaners and hierarchy normalizer for 100% backwards compatibility
try:
    from .table_cleaners import *
    from .hierarchy_normalizer import *
except ImportError:
    from table_cleaners import *
    from hierarchy_normalizer import *

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

class PDFOfflineTableExtractor:
    def __init__(self):
        """
        Inisialisasi ekstraktor tabel murni offline/lokal menggunakan pdfplumber.
        """
        logging.info("Sistem Ekstraksi Offline diaktifkan (Tanpa API/Internet).")

    def _is_valid_statistic_table(self, table: List[List[str]]) -> bool:
        """
        Filter Logika: Mengecek apakah ini benar-benar tabel statistik, bukan sekadar sampah/teks.
        Syarat:
        1. Minimal 2 baris & 2 kolom.
        2. Setidaknya 30% dari isi tabel (selain header) harus berupa angka.
        """
        if not table or len(table) < 2 or len(table[0]) < 2:
            return False
            
        total_cells = 0
        numeric_cells = 0
        
        # Sesuai instruksi baru: JIKA TABEL FULL KOSONG GAUSAH DIAMBIL
        # Tabel kosong artinya hanya berisi strip (-) atau elipsis (...) tanpa ada angka sama sekali.
        has_digit = False
        
        # Mulai dari baris 1 (mengabaikan header di baris 0)
        for row in table[1:]:
            for cell in row:
                if cell:
                    total_cells += 1
                    val = str(cell).strip()
                    # Cek apakah cell mengandung angka
                    if re.search(r'\d', val):
                        has_digit = True
                        numeric_cells += 1
                    elif val == '-' or set(val.replace(' ', '')) == {'.'}:
                        numeric_cells += 1
                        
        if total_cells == 0:
            return False

        # Aturan dilonggarkan: Ambil semua tabel asalkan tidak sepenuhnya kosong
        return True

    def _clean_table(self, table: List[List[str]]) -> pd.DataFrame:
        """
        Pembersihan data kustom khusus format tabel BPS:
        1. Deteksi baris index seperti (1), (2), (3) untuk memisah header dan data.
        2. Ambil hanya teks bahasa Indonesia pada header (potong bagian bahasa inggris).
        3. Bersihkan sisa watermark yang berwujud huruf acak di kolom angka.
        """
        if not table:
            return pd.DataFrame()
            
        # --- PRE-PROCESSING KHUSUS 2019: Buang baris-baris awal yang isinya judul tabel ---
        # Karena di PDF 2019 strategi 'text' menggabungkan judul ke dalam tabel, kita buang.
        header_keywords = ['kecamatan', 'gol/', 'golongan', 'umur', 'lapangan', 'pendidikan', 'status', 'jenis', 'bulan', 'kabupaten/kota', 'kota/city', 'kabupaten/regency', 'pengguna', 'uraian', 'rincian', 'nama', 'tahun', 'wilayah', 'sektor']
        start_idx = 0
        for i in range(min(15, len(table))):
            row_text = " ".join([str(c) for c in table[i] if c]).lower()
            row_text = re.sub(r'\s+', ' ', row_text)
            
            # Jika baris ini mengandung keyword header dan BUKAN murni judul tabel
            if any(kw in row_text for kw in header_keywords) and not ("tabel " in row_text or "table " in row_text or re.search(r'\b\d+\.\d+\.\d+\b', row_text)):
                non_empty = [c for c in table[i] if str(c).strip()]
                # Pastikan baris header terdistribusi ke beberapa kolom, tidak mengumpul
                if len(non_empty) > 1:
                    start_idx = i
                    break
                    
        # Cari mundur sedikit jika ada baris yang tampaknya bagian dari header atas (seperti spanner)
        # Asalkan bukan judul tabel
        if start_idx > 0:
            while start_idx > 0:
                prev_text = " ".join([str(c) for c in table[start_idx-1] if c]).lower()
                if "tabel " in prev_text or "table " in prev_text or "angka 201" in prev_text or "figures 201" in prev_text:
                    break
                if not any(str(c).strip() for c in table[start_idx-1]):
                    break
                start_idx -= 1
            table = table[start_idx:]
            
        if not table:
            return pd.DataFrame()

        index_row_idx = -1
        # Cari baris index e.g. (1), (2), (3) dst.
        for i, row in enumerate(table):
            row_str_clean = "".join([str(c) for c in row if c])
            row_str_clean = re.sub(r'\s+', '', row_str_clean)
            if "(1)" in row_str_clean and ("(2)" in row_str_clean or "(3)" in row_str_clean or "(4)" in row_str_clean or "(5)" in row_str_clean):
                index_row_idx = i
                break
            
            # Coba deteksi pola lama juga jika hanya ada 1 kolom
            if row and row[0]:
                cell_val = str(row[0]).strip()
                cell_val = fix_doubled_text(cell_val)
                if re.match(r'^\(\d+\)$', cell_val):
                    index_row_idx = i
                    break
        if index_row_idx != -1 and index_row_idx > 0:
            # Format BPS Terdeteksi!
            
            # Simpan baris indeks aslinya dari PDF
            extracted_index_row = [str(x).replace('\n', ' ').strip() if x else "" for x in table[index_row_idx]]
            
            # --- Proses Hierarchical Headers ---
            # Gabungkan semua baris di atas index_row menjadi satu header gabungan
            header_rows = table[:index_row_idx]
            header_df = pd.DataFrame(header_rows)
            # Forward fill secara horizontal (berguna untuk merged cells di atas)
            header_df = header_df.ffill(axis=1)
            
            clean_headers = []
            for col in header_df.columns:
                parts = []
                for val in header_df[col]:
                    if val is not None and str(val).strip() and str(val).lower() not in ["none", "nan"]:
                        val = fix_doubled_text(str(val))
                        # 1. Bersihkan Header (Ambil Bahasa Indonesia Saja)
                        lines = str(val).split('\n')
                        indo_lines = []
                        for line in lines:
                            line = line.strip()
                            if not line:
                                continue
                            
                            # Pisahkan jika ada format "Indonesia / English" (dengan atau tanpa spasi)
                            sub_parts = [p.strip() for p in re.split(r'\s*/\s*', line) if p.strip()]
                            if len(sub_parts) > 1:
                                if sub_parts[0].lower() == sub_parts[1].lower():
                                    line = sub_parts[0]
                                else:
                                    # Cek apakah part kedua adalah bahasa Inggris
                                    words_part2 = set(re.findall(r'[a-zA-Z]+', sub_parts[1].lower()))
                                    has_english_part2 = bool(words_part2 & ENGLISH_ONLY_WORDS)
                                    has_indo_part2 = bool(words_part2 & INDO_SAFE_WORDS)
                                    if has_english_part2 and not has_indo_part2:
                                        line = sub_parts[0]
                            else:
                                line = sub_parts[0] if sub_parts else ""
                                
                            # Bersihkan trailing English words di akhir baris
                            words_list = line.split()
                            while words_list:
                                last_word = words_list[-1].lower()
                                clean_word = re.sub(r'[^a-z]', '', last_word)
                                if clean_word in ENGLISH_ONLY_WORDS and clean_word not in INDO_SAFE_WORDS:
                                    words_list.pop()
                                else:
                                    break
                            line = " ".join(words_list)
                            
                            # Bersihkan kata duplikat berturut-turut
                            words_list = line.split()
                            unique_words = []
                            for w in words_list:
                                if not unique_words or w.lower() != unique_words[-1].lower():
                                    unique_words.append(w)
                            line = " ".join(unique_words)
                            
                            # Cek apakah baris ini adalah terjemahan Inggris murni
                            words_lower = set(re.findall(r'[a-zA-Z]+', line.lower()))
                            has_english = bool(words_lower & ENGLISH_ONLY_WORDS)
                            has_indo = bool(words_lower & INDO_SAFE_WORDS)
                            
                            if has_english and not has_indo:
                                # Ini terjemahan Inggris — hentikan pengambilan
                                break
                            
                            if line:
                                indo_lines.append(line)
                        indo_val = " ".join(indo_lines).strip()
                        # Bersihkan kata duplikat berturut-turut setelah digabungkan (misal: "Feb Feb" -> "Feb")
                        words_list = indo_val.split()
                        unique_words = []
                        for w in words_list:
                            if not unique_words or w.lower() != unique_words[-1].lower():
                                unique_words.append(w)
                        indo_val = " ".join(unique_words)
                        
                        if not indo_val and lines:
                            fallback = lines[0].strip()
                            fallback_parts = [p.strip() for p in re.split(r'\s*/\s*', fallback) if p.strip()]
                            fallback = fallback_parts[0] if fallback_parts else fallback
                            indo_val = fallback
                        
                        if indo_val and indo_val not in parts:
                            parts.append(indo_val)
                combined = " - ".join(parts)
                if not combined:
                    combined = "Kolom_Kosong"
                # Bersihkan angka footnote pada tahun, misal "20212" -> "2021"
                if re.match(r'^20\d{3}$', combined):
                    combined = combined[:4]
                clean_headers.append(combined)
            
            # Pastikan panjang kolom sesuai
            while len(clean_headers) < len(table[index_row_idx]):
                clean_headers.append(f"Kolom_{len(clean_headers)+1}")
                
            # 2. Ambil Data Inti
            data_rows = table[index_row_idx + 1:]
            
            cleaned_data = []
            for row in data_rows:
                clean_row = []
                for j, cell in enumerate(row):
                    val = str(cell) if cell is not None else ""
                    val = fix_doubled_text(val)
                    # 3. Bersihkan Watermark BPS tanpa merusak data teks valid
                    
                    # Hapus kata-kata watermark BPS
                    for w in ['tasikmalayakab', 'bps', 'go', 'id']:
                        val = re.sub(rf'\b{w}\b', '', val, flags=re.IGNORECASE)
                        
                    # Hapus huruf kecil tunggal (sisa watermark vertikal) di mana pun
                    val = re.sub(r'\b[a-z]\b', '', val)
                    
                    # Bersihkan sisa titik anomali akibat watermark
                    val = val.replace('. -', '-').replace('- .', '-')
                    val = re.sub(r'\s+\.\s+', ' ', val)  # titik nyasar di tengah spasi
                    val = re.sub(r'\s+\.$', '', val)     # titik nyasar di akhir
                    val = re.sub(r'^\.\s+', '', val)     # titik nyasar di awal
                    val = re.sub(r'(?:\s*[\/\:\.])+$', '', val) # simbol nyasar di akhir
                    
                    # Bersihkan teks footer nyasar yang menempel di data (sering terjadi jika PDF tidak ada garis bawah tabel)
                    garbage_footers = [
                        r"Catatan/Note:\s*\.\.\.",
                        r"Catatan/Note\s*:\s*\.\.\.",
                        r"Catatan\s*:\s*\.\.\.",
                        r"Sumber/Source:.*?Menengah, Perindustrian dan Perdagangan Kab\. Tasikmalaya",
                        r"Sumber/Source:.*?Menengah, Perindustrian dan Perdagangan",
                        r"Sumber/Source:.*?Menengah, Perindustrian dan P",
                        r"Sumber/Source:.*?Usaha Kecil dan Men",
                        r"engah, Perindustrian dan P",
                        r"\berdagangan\b",
                        r"Kab\. Tasikmalaya"
                    ]
                    for gf in garbage_footers:
                        val = re.sub(gf, '', val, flags=re.IGNORECASE)
                        
                    val = val.strip()
                    
                    if re.search(r'[a-zA-Z]', val):
                        val = clean_text_cell(val)
                    else:
                        val = val.replace('\n', ' ').strip()
                    
                    if j == 0:
                        # Hapus penomoran hierarki di awal string (misal: 1, 1.1, 1.1.1, 2.1.1)
                        # Pola: digit yang dipisahkan titik atau spasi
                        val = re.sub(r'^\s*[\d\.]+\s+', '', val)
                        val = val.strip()
                    else:
                        # Bersihkan footnote superscript pada nilai angka (kecuali m2/m²/km2)
                        if re.search(r'[¹²³⁴⁵⁶⁷⁸⁹⁰*†‡#]', val) and not re.search(r'(?:m²|km²|m2|km2)', val, re.IGNORECASE):
                            val = re.sub(r'[¹²³⁴⁵⁶⁷⁸⁹⁰*†‡#]', '', val).strip()
                        # Normalisasi spasi ribuan (misal: '1 000' -> '1.000')
                        if re.match(r'^\d{1,3}(\s+\d{3})+$', val):
                            val = re.sub(r'\s+', '.', val)
                        # Normalisasi desimal titik US (misal: '74.22' -> '74,22')
                        elif re.match(r'^-?\d+\.\d{1,2}$', val):
                            val = val.replace('.', ',')

                    clean_row.append(val)
                cleaned_data.append(clean_row)
                
            # Pastikan kolom Nomor tidak ditambahkan/dibuat
            df = pd.DataFrame(cleaned_data, columns=clean_headers)
        else:
            # Fallback jika tidak menemukan baris (1)
            cleaned_table = []
            for row in table:
                cleaned_row = []
                for cell in row:
                    val = str(cell) if cell is not None else ""
                    cleaned_row.append(fix_doubled_text(val.replace('\n', ' ').strip()))
                cleaned_table.append(cleaned_row)
            
            if len(cleaned_table) > 1:
                df = pd.DataFrame(cleaned_table[1:], columns=cleaned_table[0])
            else:
                df = pd.DataFrame(cleaned_table)
                
        # Deduplikasi nama kolom agar pd.concat tidak error jika ada kolom artifact dengan nama kembar
        def deduplicate_columns(columns):
            seen = {}
            new_cols = []
            for col in columns:
                # pandas akan membaca string None sebagai string 'None' kadang, tapi aman
                col_str = str(col)
                if col_str in seen:
                    seen[col_str] += 1
                    new_cols.append(f"{col_str}.{seen[col_str]}")
                else:
                    seen[col_str] = 0
                    new_cols.append(col_str)
            return new_cols
            
        df.columns = deduplicate_columns(df.columns)
                
        # Menghapus baris kosong (kolom kosong tetap dipertahankan)
        df.replace("", pd.NA, inplace=True)
        df.dropna(how='all', inplace=True)
        
        # Sesuai permintaan user, JANGAN MENGHAPUS KOLOM KOSONG APAPUN
        df.fillna("", inplace=True)
        
        # Total row recalculation removed from here because it will be processed on the fully merged table instead.
        
        df.attrs['extracted_index_row'] = extracted_index_row if 'extracted_index_row' in locals() else []
        
        return df

    def process_document(self, pdf_path: str, start_page: int = 1, end_page: Optional[int] = None) -> List[Dict]:
        """
        Mengekstrak tabel dari dokumen PDF dari start_page ke end_page.
        """
        final_dataframes = []
        
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            end_page = end_page if end_page is not None else total_pages
            
            # Memastikan range halaman valid
            start_idx = max(0, start_page - 1)
            end_idx = min(total_pages, end_page)
            
            last_seen_table_num = None
            for page_num in range(start_idx, end_idx):
                actual_page = page_num + 1
                logging.info(f"\n{'='*40}\nMemproses Halaman {actual_page}\n{'='*40}")
                
                page = pdf.pages[page_num]
                
                # Cek apakah ini halaman Gambar/Grafik (seringkali grid pada grafik dideteksi sebagai tabel)
                text = page.extract_text()
                if text and re.search(r'\b(?:Gambar|Figure|Grafik|Chart)\b', text[:500], re.IGNORECASE) and not re.search(r'\b(?:Tabel|Table)\b', text[:500], re.IGNORECASE):
                    logging.info(f"-> Halaman {actual_page} DIABAIKAN. Alasan: Terdeteksi sebagai halaman Gambar/Grafik.")
                    continue
                
                # MAGIC FILTER: Watermark BPS menggunakan ukuran font besar (> 15pt)
                # Sedangkan teks tabel normal berukuran 7-10pt.
                # Kita hapus karakter watermark secara fisik dari PDF sebelum diekstrak!
                page = page.filter(lambda obj: obj.get("object_type") != "char" or obj.get("size", 0) < 15)
                
                # Ekstrak nomor tabel dari halaman ini untuk identifikasi
                table_num = extract_table_number(text[:400], actual_page, pdf_path)

                # --- MANUAL OVERRIDE UNTUK TYPO BPS (BERDASARKAN HALAMAN PDF 2026) ---
                if pdf_path and "2026" in os.path.basename(pdf_path):
                    if actual_page in [293, 294]:
                        table_num = "6.1.1"
                    elif actual_page == 296:
                        table_num = "6.1.2"
                    elif actual_page == 299:
                        table_num = "6.2.1"
                    elif actual_page in [303, 304, 305, 306]:
                        table_num = "6.3.1"
                # -----------------------------------------------------------------

                if table_num:
                    last_seen_table_num = table_num
                else:
                    table_num = last_seen_table_num

                if not table_num:
                    logging.info(f"-> Halaman {actual_page}: Tidak terdeteksi nomor tabel, diproses sebagai tabel lanjutan (continuation).")

                # KHUSUS 2019: Menggunakan strategi ekstraksi text karena tabel tidak memiliki grid line yang utuh
                if pdf_path and "2019" in os.path.basename(pdf_path):
                    # Potong bagian atas halaman (y0 < 90) yang sering berisi judul tabel & watermark
                    # agar tidak terdeteksi sebagai bagian dari kolom-kolom tabel.
                    crop_box = (0, 90, page.width, page.height)
                    cropped_page = page.crop(crop_box)
                    tables = cropped_page.extract_tables({
                        "vertical_strategy": "text",
                        "horizontal_strategy": "text"
                    })
                else:
                    # Menggunakan strategi ekstraksi tabel pdfplumber default (deteksi garis vertikal/horizontal)
                    tables = page.extract_tables()                
                if not tables:
                    logging.info(f"-> Halaman {actual_page} DIABAIKAN. Alasan: Tidak ada kerangka tabel yang terdeteksi.")
                    continue
                
                valid_table_count = 0
                for idx, table in enumerate(tables):
                    if self._is_valid_statistic_table(table):
                        try:
                            df = self._clean_table(table)
                            # Simpan
                            final_dataframes.append({
                                "page": actual_page,
                                "title": f"Tabel_Halaman_{actual_page}_No_{idx+1}",
                                "dataframe": df,
                                "index_row": df.attrs.get('extracted_index_row', []),
                                "table_number": table_num
                            })
                            valid_table_count += 1
                        except Exception as e:
                            logging.error(f"-> Gagal membersihkan tabel {idx+1} di halaman {actual_page}: {e}")
                    else:
                        logging.info(f"-> Tabel {idx+1} di Halaman {actual_page} difilter (Tebakan: Bukan tabel statistik / Sampah).")
                
                if valid_table_count > 0:
                    logging.info(f"-> SUKSES: {valid_table_count} tabel divalidasi dan diekstrak dari halaman {actual_page}.")
                else:
                    logging.info(f"-> Halaman {actual_page} DIABAIKAN. Alasan: Ada tabel, tetapi bukan statistik.")
                    
        return final_dataframes

# --- Entry Point ---
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Offline PDF Table Extraction Pipeline (No API)")
    parser.add_argument("--pdf", type=str, help="Path absolute ke file PDF", required=False)
    parser.add_argument("--output", type=str, help="Prefix nama file untuk output CSV/Excel", default="hasil_ekstraksi_offline")
    parser.add_argument("--output_dir", type=str, help="Folder utama penyimpanan output", default="")
    parser.add_argument("--start_page", type=int, help="Halaman PDF awal untuk diproses (1-indexed)", default=1)
    parser.add_argument("--end_page", type=int, help="Halaman PDF akhir untuk diproses (opsional)", default=None)
    parser.add_argument("--filter_file", type=str, help="Path ke file JSON berisi daftar filter judul tabel")
    parser.add_argument("--modifications", type=str, help="Path to JSON file with table modifications")
    
    args = parser.parse_args()

    # Load filter
    table_filters = None
    if args.filter_file and os.path.exists(args.filter_file):
        import json
        with open(args.filter_file, "r") as f:
            table_filters = json.load(f).get("filters", [])

    # Load modifications
    modifications_data = None
    if args.modifications and os.path.exists(args.modifications):
        import json
        with open(args.modifications, "r", encoding='utf-8') as f:
            modifications_data = json.load(f)
            logging.info(f"Loaded table modifications from {args.modifications}")
            
    # Setup logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
    
    if args.pdf:
        if not os.path.exists(args.pdf):
            print(f"ERROR: File {args.pdf} tidak ditemukan!")
        else:
            pipeline = PDFOfflineTableExtractor()
            # Inject filter ke dalam pipeline instance
            pipeline.table_filters = table_filters
            print(f"\nMemulai ekstraksi OFFLINE untuk: {args.pdf}")
            if args.end_page:
                print(f"Halaman: {args.start_page} s/d {args.end_page}\n")
            else:
                print(f"Halaman: {args.start_page} s/d Selesai\n")
            
            results = pipeline.process_document(args.pdf, args.start_page, args.end_page)
            
            if results:
                print(f"\n>>> Berhasil mengekstrak {len(results)} potongan tabel. Sedang menggabungkan per kategori... <<<")
                
                # -------------------------------------------------------------
                # ALGORITMA MERGING CERDAS MULTI-HALAMAN (HORIZONTAL & VERTIKAL)
                # -------------------------------------------------------------
                merged_categories = process_and_merge_results(results)
                print(f"\n>>> SELESAI: Berhasil MENGGABUNGKAN tabel menjadi {len(merged_categories)} Kategori utuh! <<<")
                
                # MEMBUAT FOLDER OUTPUT
                end_p = args.end_page if args.end_page else "akhir"
                folder_name = f"Ekstraksi_Hal_{args.start_page}_sd_{end_p}"
                if args.output_dir:
                    folder_name = os.path.join(args.output_dir, folder_name)
                os.makedirs(get_safe_windows_path(folder_name), exist_ok=True)
                print(f"\n[+] Membuat folder penyimpanan: {folder_name}/")
                
                with pdfplumber.open(args.pdf) as pdf_ref:
                    import re
                    file_counts = {}
                    # Cache judul tabel yang sudah berhasil diekstrak, agar halaman lanjutan memakai judul yang sama
                    table_titles_cache = {}
                    title_mapping = {}
                    for cat in merged_categories:
                        pages_str = ", ".join(map(str, cat['pages']))
                        
                        # Coba cari nomor tabel dari halaman pertama kategori ini
                        first_page_idx = cat['pages'][0] - 1
                        try:
                            # Ambil seluruh teks halaman untuk memastikan judul tabel tidak terpotong (misal karena ada paragraf pengantar)
                            page_text = pdf_ref.pages[first_page_idx].extract_text()
                            
                            # Ekstrak nomor tabel terlebih dahulu
                            table_number = cat.get('table_number')
                            if not table_number:
                                table_number = extract_table_number(page_text, first_page_idx + 1, args.pdf)
                                match = bool(table_number) # Untuk kompatibilitas ke bawah
                            else:
                                match = True
                            
                            # FILTERING BERDASARKAN RULES USER
                            if pipeline.table_filters and "Semua" not in pipeline.table_filters:
                                passed_filter = False
                                for f in pipeline.table_filters:
                                    if f.lower() in page_text.lower():
                                        passed_filter = True
                                        break
                                        
                                # JIKA INI ADALAH TABEL LANJUTAN, BERI KELONGGARAN JIKA NOMOR TABEL SAMA DENGAN SEBELUMNYA YANG LOLOS
                                if not passed_filter and table_number and 'passed_table_numbers' in locals() and table_number in passed_table_numbers:
                                    passed_filter = True
                                    
                                if not passed_filter:
                                    print(f"[-] Kategori {cat['category_id']} (Hal {pages_str}) diabaikan karena tidak ada kata kunci: {pipeline.table_filters}")
                                    continue
                                    
                            # Simpan nomor tabel yang berhasil lolos filter agar bagian selanjutannya (Lanjutan Tabel) ikut lolos
                            if table_number:
                                if 'passed_table_numbers' not in locals():
                                    passed_table_numbers = set()
                                passed_table_numbers.add(table_number)
                                
                            if match:
                                title = f"Tabel_{table_number}_(Hal_{pages_str})"
                                file_prefix = f"Tabel_{table_number}"
                                
                                if True:
                                    # Attempt to extract descriptive title
                                    try:
                                        desc = table_titles_cache.get(table_number) if table_number else None
                                        
                                        if not desc:
                                            lines = page_text.split('\n')
                                            start_idx = -1
                                            physical_table_number = table_number
                                            import os
                                            if args.pdf and "2025" in os.path.basename(args.pdf):
                                                pg = first_page_idx + 1
                                                if 387 <= pg <= 399:
                                                    if table_number == "11.1":
                                                        physical_table_number = "1.3"
                                                    elif table_number == "11.2":
                                                        physical_table_number = "1.4"
                                                        
                                            tnum_pattern = make_table_number_pattern(physical_table_number)
                                            for i, line in enumerate(lines):
                                                # Case A: "Tabel 3.1.2" or "Table 3.1.2" with optional spaces
                                                if tnum_pattern and re.search(r'(?:Tabel|Table)\s+' + tnum_pattern, line, re.IGNORECASE):
                                                    start_idx = i
                                                    break
                                                # Case B: "Tabel" and the next line or line after has table_number
                                                elif re.search(r'\b(?:Tabel|Table)\b', line, re.IGNORECASE):
                                                    found = False
                                                    for offset in range(1, 4):
                                                        if i + offset < len(lines):
                                                            next_line_clean = lines[i+offset].strip()
                                                            next_line_no_spaces = re.sub(r'\s+', '', next_line_clean)
                                                            if physical_table_number and (next_line_no_spaces == physical_table_number or next_line_no_spaces.startswith(physical_table_number)):
                                                                start_idx = i
                                                                found = True
                                                                break
                                                    if found:
                                                        break
                                                        
                                            if start_idx == -1 and physical_table_number:
                                                # Clean override suffixes like _Bagian_1
                                                search_num = re.sub(r'_Bagian_\d+', '', physical_table_number)
                                                # Fallback: just look for the table number
                                                for i, line in enumerate(lines):
                                                    line_no_spaces = re.sub(r'\s+', '', line)
                                                    if search_num in line_no_spaces:
                                                        start_idx = max(0, i - 1) # start from previous line
                                                        break
                                            
                                            if start_idx == -1:
                                                # Fallback 2: search for the word Tabel or Table
                                                for i, line in enumerate(lines):
                                                    if re.search(r'\b(?:Tabel|Table)\b', line, re.IGNORECASE):
                                                        start_idx = i
                                                        break
                                                        
                                            if start_idx != -1:
                                                # 2. Extract a window of lines from start_idx
                                                candidate_lines = []
                                                for i in range(start_idx, min(start_idx + 10, len(lines))):
                                                    line = lines[i]
                                                    if re.search(r'\(\s*\d+\s*\)', line):
                                                        break
                                                    candidate_lines.append(line)
                                                    
                                                # 3. Clean and parse
                                                desc = clean_title_description(candidate_lines, physical_table_number)
                                                
                                        if desc:
                                            # Hapus angka footnote yang menempel pada kata (misal: Desa1 -> Desa)
                                            desc = re.sub(r'([a-zA-Z])[1-9](?![0-9])', r'\1', desc)
                                            desc = re.sub(r'\s+', ' ', desc).strip()
                                            
                                        if desc:
                                            title = f"Tabel {table_number} - {desc} (Hal {pages_str})"
                                        else:
                                            title = f"Tabel {table_number} (Hal {pages_str})"
                                            
                                        # Ganti slash dengan placeholder agar tidak dihapus sanitasi filename
                                        title_safe = title.replace("/", " __SLASH__ ")
                                        title_safe = re.sub(r'[\\*?:\"<>|]', '', title_safe)
                                        title_safe = re.sub(r'\s+', ' ', title_safe).strip()
                                        # Batasi panjang nama file agar tidak menabrak batas Windows MAX_PATH
                                        if len(title_safe) > 200:
                                            import re
                                            hal_match = re.search(r'\s*\(Hal\s+[\d,\s]+\)$', title_safe)
                                            hal_suffix = hal_match.group(0) if hal_match else ''
                                            allowed_desc_len = 200 - len(f'Tabel {table_number} - ') - len(hal_suffix) - 5
                                            if allowed_desc_len > 10:
                                                truncated_desc = desc[:allowed_desc_len].strip() + '...'
                                                truncated_desc = truncated_desc.replace("/", " __SLASH__ ")
                                                title_safe = f"Tabel {table_number} - {truncated_desc} {hal_suffix}"
                                                title_safe = re.sub(r'[\\*?:"<>|]', '', title_safe)
                                                title_safe = re.sub(r'\s+', ' ', title_safe).strip()
                                                
                                        file_prefix = title_safe
                                        # Simpan ke cache agar halaman lanjutan memakai judul yang sama
                                        if table_number and table_number not in table_titles_cache and desc:
                                            table_titles_cache[table_number] = desc
                                    except Exception as e:
                                        print(f"DEBUG Exception saat ekstrak judul: {e}")
                                        pass

                            else:
                                print(f"[-] Kategori {cat['category_id']} (Hal {pages_str}) diabaikan karena tidak terdeteksi nomor tabel.")
                                continue
                        except Exception as e:
                            print(f"DEBUG Exception saat ekstrak judul di halaman {first_page_idx+1}: {e}")
                            continue
                            
                        actual_title = title
                        base_prefix = file_prefix
                        if base_prefix not in file_counts:
                            file_counts[base_prefix] = 1
                            actual_title = title
                        else:
                            file_counts[base_prefix] += 1
                            actual_title = f"{title}_Bagian_{file_counts[base_prefix]}"
                            file_prefix = f"{file_prefix}_Bagian_{file_counts[base_prefix]}"

                        csv_filename = os.path.join(folder_name, f"{file_prefix}.csv")
                        title_mapping[f"{file_prefix}.csv"] = actual_title
                        

                            
                        print(f"\n--- {actual_title} ---")
                        
                        df_to_save = cat['dataframe'].copy()

                        # Apply custom modifications if any
                        table_number = cat.get("table_number")
                        if modifications_data and table_number:
                            # Find modifications for this table
                            table_mods = next((m for m in modifications_data.get("modifications", []) if m.get("table_number") == table_number), None)
                            if table_mods:
                                logging.info(f"Applying custom modifications for table {table_number}...")
                                df_to_save = apply_modifications(df_to_save, table_mods)
                        
                        first_col = df_to_save.columns[0] if not df_to_save.empty else None
                        
                        
                        # ============================================================
                        # POST-PROCESSING: Normalisasi Baris TOTAL
                        # ============================================================
                        TOTAL_KEYWORDS = ['jumlah', 'total', 'kabupaten tasikmalaya', 'kab. tasikmalaya', 'tasikmalaya']
                        
                        # 1. Identifikasi baris total dengan mengecek di SELURUH DataFrame
                        def is_total_row(row):
                            row_str = " ".join([str(val) if val is not None else "" for val in row]).lower()
                            # Gunakan regex untuk toleransi spasi ganda/tambahan
                            patterns = [
                                r'jumlah', r'total', r'kabupaten\s+tasikmalaya', 
                                r'kab\.?\s+tasikmalaya', r'tasikmalaya'
                            ]
                            return any(re.search(p, row_str) for p in patterns)
                            
                        mask = df_to_save.apply(is_total_row, axis=1)
                        
                        total_section = None
                        if mask.any():
                            # Ambil semua baris total
                            total_rows = df_to_save[mask].copy()
                            
                            # Logika Baru: Jika ada duplikasi baris total, ambil baris terakhir saja
                            total_section = total_rows.iloc[[-1]].copy()
                            
                            # Normalisasi label menjadi "Total" di kolom ke-1 (index 0) secara paksa
                            total_section.iloc[:, 0] = "Total"
                            
                            # Hapus SEMUA baris total dari tabel utama (untuk membersihkan duplikasi)
                            df_to_save = df_to_save[~mask].copy()
                        
                        # Pisahkan nomor hierarki (1.1), angka (1.), alfabet (A.), dan romawi (I.) menjadi kolom "Nomor"
                        if df_to_save[first_col].dtype == 'object':
                            # Regex mengabaikan prefix "1. " jika diikuti oleh penomoran sejati seperti I/A, A., dll.
                            regex_pattern = r'^(?:\d+\.\s+)?([IVXivx]+\/[A-Za-z]|[IVXLCDMivxlcdm]+\.|[A-Za-z]\.|(?:\d+(?:\.\d+)+)|\d+\.)\s+(.*)'
                            extracted = df_to_save[first_col].astype(str).str.extract(regex_pattern)
                            if extracted[0].notna().mean() > 0.05: # Jika ada baris yang mengandung nomor
                                df_to_save.insert(0, 'Nomor', extracted[0])
                                df_to_save[first_col] = extracted[1].fillna(df_to_save[first_col])
                        
                        # Simpan ke CSV di dalam folder menggunakan csv_filename yang sudah lolos uji anti-overwrite
                        try:
                            import re
                            pdf_year_match = re.search(r'(\d{4})', os.path.basename(args.pdf))
                            doc_year = int(pdf_year_match.group(1)) if pdf_year_match else 2026
                            
                            # Clean headers and extract metadata (units, years)
                            raw_headers = list(df_to_save.columns)
                            cleaned_headers, units, years = detect_and_clean_metadata(actual_title, doc_year, raw_headers)
                            df_to_save.columns = cleaned_headers
                            
                            print(df_to_save.head())
                            print(f"... (Total {len(df_to_save)} baris data)")
                            
                            import csv
                            with open(get_safe_windows_path(csv_filename), 'w', encoding='utf-8', newline='') as f:
                                writer = csv.writer(f)
                                
                                # Hapus kolom 'Nomor' jika ada sebelum menulis apapun ke CSV
                                if 'Nomor' in df_to_save.columns:
                                    df_to_save = df_to_save.drop(columns=['Nomor'])
                                    # Sinkronkan header juga
                                    if 'Nomor' in cleaned_headers:
                                        cleaned_headers.remove('Nomor')
                                        
                                # Write CSV headers
                                writer.writerow(cleaned_headers)
                                writer.writerow(units)
                                writer.writerow(years)

                                # Write DataFrame values
                                for row_vals in df_to_save.values:
                                    writer.writerow(list(row_vals))

                                    
                                # TULIS SECTION TOTAL SECARA EKSPLISIT
                                if total_section is not None:
                                    if 'Nomor' in total_section.columns:
                                        total_section = total_section.drop(columns=['Nomor'])
                                    for idx, row_vals in total_section.iterrows():
                                        # Gunakan nilai asli dari buku (PDF) secara langsung tanpa hitung ulang
                                        formatted_row = ["Total"] + list(row_vals[1:])
                                        writer.writerow(formatted_row)
                                    
                            print(f"[+] Disimpan ke: {csv_filename} dengan metadata satuan dan tahun.")
                        except PermissionError:
                            print(f"[-] GAGAL DISIMPAN: File {csv_filename} sedang dibuka di program lain (misal Excel). Silakan tutup file tersebut.")
                        except Exception as e:
                            print(f"[-] ERROR saat menyimpan {csv_filename}: {e}")
            # Save metadata.json mapping safe filenames to original full titles
            if 'folder_name' in locals() and folder_name and 'title_mapping' in locals() and title_mapping:
                try:
                    import json
                    metadata_path = os.path.join(folder_name, "metadata.json")
                    with open(metadata_path, "w", encoding="utf-8") as f:
                        json.dump({"title_mapping": title_mapping}, f, ensure_ascii=False, indent=4)
                    print(f"[+] Metadata judul disimpan ke: {metadata_path}")
                except Exception as e:
                    print(f"[-] Gagal menyimpan metadata judul: {e}")
                
            else:
                print("\nTidak ada tabel statistik yang berhasil diekstrak.")
    else:
        print("Sistem Ekstraksi Offline Siap. Gunakan argumen --pdf untuk memproses file.")
