import os
import re
import logging
import pandas as pd
import pdfplumber
from typing import List, Dict, Optional

# Konfigurasi logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

ENGLISH_ONLY_WORDS = {
    'district', 'population', 'growth', 'rate', 'percentage', 'density',
    'sex', 'ratio', 'age', 'groups', 'male', 'female', 'area', 'month',
    'value', 'amount', 'source', 'continued', 'regency', 'figures',
    'sq', 'people', 'annual', 'number', 'province', 'village', 'sub',
    'and', 'of', 'by', 'in', 'the', 'for', 'to', 'distribution', 'total',
    'regency', 'municipal', 'city', 'level', 'altitude', 'distance', 'capital',
    'activity', 'main', 'jan', 'january', 'feb', 'february', 'mar', 'march',
    'apr', 'april', 'may', 'jun', 'june', 'jul', 'july', 'aug', 'august',
    'sep', 'september', 'oct', 'october', 'nov', 'november', 'dec', 'december',
    'status', 'employment', 'unemployment', 'labor', 'force', 'participation',
    'work', 'working', 'job', 'industry', 'occupation', 'agriculture',
    'forestry', 'fishing', 'mining', 'quarrying', 'manufacturing',
    'electricity', 'gas', 'water', 'construction', 'trade', 'hotel',
    'restaurant', 'transport', 'communication', 'finance', 'services'
}

INDO_SAFE_WORDS = {
    'kecamatan', 'kabupaten', 'kelurahan', 'penduduk', 'laju', 'jenis',
    'rasio', 'persentase', 'distribusi', 'kepadatan', 'menurut', 'jumlah',
    'desa', 'tahun', 'pertumbuhan', 'jiwa', 'dan', 'di', 'atau',
    'menurut', 'dalam', 'angka', 'banyaknya', 'tabel', 'klasifikasi',
    'tinggi', 'wilayah', 'jarak', 'ibukota', 'luas', 'daerah', 'pulau',
    'laki', 'perempuan', 'kegiatan', 'utama', 'pekerjaan', 'pengangguran',
    'angkatan', 'kerja', 'partisipasi', 'tpt', 'tpak', 'uraian',
    'jan', 'januari', 'peb', 'pebruari', 'feb', 'februari', 'mar', 'maret',
    'apr', 'april', 'mei', 'jun', 'juni', 'jul', 'juli', 'agt', 'agustus',
    'sep', 'september', 'okt', 'oktober', 'nov', 'nopember', 'des', 'desember'
}

def get_safe_windows_path(path: str) -> str:
    if os.name == 'nt':
        abs_path = os.path.abspath(path)
        if not abs_path.startswith("\?"):
            return "\?" + abs_path.replace("/", "")
    return path

def fix_doubled_text(text):
    if not text: return text
    text = str(text)
    pairs = 0
    i = 0
    while i < len(text) - 1:
        if text[i] == text[i+1]:
            pairs += 1
            i += 2
        else:
            i += 1
    
    if (pairs * 2) >= len(text) * 0.7:
        return re.sub(r'(.)\1', r'\1', text)
    return text

def parse_indonesian_number(val_str):
    if not val_str:
        return None
    val_str = str(val_str).strip()
    # Hapus spasi dan simbol aneh kecuali digit, koma, titik, minus
    val_str = re.sub(r'[^\d,\.-]', '', val_str)
    if not val_str:
        return None
    
    # Case 1: Both dot and comma present
    if '.' in val_str and ',' in val_str:
        if val_str.find('.') < val_str.find(','):
            # dot is thousands, comma is decimal (standard Indo: 1.234,56)
            val_str = val_str.replace('.', '').replace(',', '.')
        else:
            # comma is thousands, dot is decimal (standard Eng: 1,234.56)
            val_str = val_str.replace(',', '').replace('.', '.')
    # Case 2: Only comma present
    elif ',' in val_str:
        val_str = val_str.replace(',', '.')
    # Case 3: Only dot present
    elif '.' in val_str:
        if val_str.count('.') > 1:
            val_str = val_str.replace('.', '')
        else:
            parts = val_str.split('.')
            if len(parts) == 2 and len(parts[1]) == 3:
                # Thousands separator (e.g. 74.433)
                val_str = val_str.replace('.', '')
            elif len(parts) == 2 and len(parts[1]) != 3:
                # Decimal separator (e.g. 1.17)
                pass
            else:
                val_str = val_str.replace('.', '')
    
    try:
        return float(val_str)
    except ValueError:
        return None

def clean_text_cell(val: str) -> str:
    """
    Remove English translations from table cells/values, handling both newlines and slashes.
    """
    if not val:
        return val
    
    val = str(val).strip()
    
    # Split by newline first, as BPS often puts English translations on new lines
    lines = val.split('
')
    clean_lines = []
    
    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue
            
        # Pisahkan jika ada format "Indonesia / English" (dengan atau tanpa spasi)
        parts = [p.strip() for p in re.split(r'\s*/\s*', line_clean) if p.strip()]
        if len(parts) > 1:
            if parts[0].lower() == parts[1].lower():
                line_clean = parts[0]
            else:
                # Check if the second part is English
                words_part2 = set(re.findall(r'[a-zA-Z]+', parts[1].lower()))
                has_english_part2 = bool(words_part2 & ENGLISH_ONLY_WORDS)
                has_indo_part2 = bool(words_part2 & INDO_SAFE_WORDS)
                if has_english_part2 and not has_indo_part2:
                    line_clean = parts[0]
        else:
            line_clean = parts[0] if parts else ""
            
        # Bersihkan trailing English words di akhir baris
        words_list = line_clean.split()
        while words_list:
            last_word = words_list[-1].lower()
            clean_word = re.sub(r'[^a-z]', '', last_word)
            if clean_word in ENGLISH_ONLY_WORDS and clean_word not in INDO_SAFE_WORDS:
                words_list.pop()
            else:
                break
        line_clean = " ".join(words_list)
        
        # Bersihkan kata duplikat berturut-turut
        words_list = line_clean.split()
        unique_words = []
        for w in words_list:
            if not unique_words or w.lower() != unique_words[-1].lower():
                unique_words.append(w)
        line_clean = " ".join(unique_words)
        
        # Periksa apakah line_clean adalah bahasa Inggris murni
        words = set(re.findall(r'[a-zA-Z]+', line_clean.lower()))
        has_english = bool(words & ENGLISH_ONLY_WORDS)
        has_indo = bool(words & INDO_SAFE_WORDS)
        
        # Hitung jumlah kata masing-masing bahasa
        english_count = len(words & ENGLISH_ONLY_WORDS)
        indo_count = len(words & INDO_SAFE_WORDS)
        
        if has_english and (english_count > indo_count or not has_indo):
            # English line, stop reading further
            break
            
        if line_clean:
            clean_lines.append(line_clean)
            
    joined = " ".join(clean_lines).strip()
    
    # Final consecutive duplicate word cleanup
    words_list = joined.split()
    unique_words = []
    for w in words_list:
        if not unique_words or w.lower() != unique_words[-1].lower():
            unique_words.append(w)
    return " ".join(unique_words)

def make_table_number_pattern(table_number: str) -> str:
    if not table_number:
        return ""
    # Split by dots, escape each part, and join with optional whitespace around dots
    parts = table_number.split('.')
    return r'\s*\.\s*'.join(re.escape(p) for p in parts)

def extract_table_number(page_text: str) -> Optional[str]:
    if not page_text:
        return None
    # 1. Look for "Tabel/Table <number>"
    # Allow spaces inside the number (e.g. 3. 1. 2 or 3 . 1 . 2)
    match = re.search(r'(?:Tabel|Table)[\s\S]{0,150}?(\d+(?:\s*\.\s*\d+)+[a-zA-Z]?)', page_text, re.IGNORECASE)
    if match:
        return re.sub(r'\s+', '', match.group(1))
    
    # 2. Fallback: look for a standalone number like 3.1.2 or 3.1
    match = re.search(r'\b(\d+(?:\s*\.\s*\d+){1,3}[a-zA-Z]?)\b', page_text)
    if match:
        # Check if the number has at least one dot
        num = re.sub(r'\s+', '', match.group(1))
        if '.' in num:
            return num
    return None

def is_dimension_column(header: str) -> bool:
    if not header:
        return True
    header_lower = header.strip().lower()
    dimension_keywords = [
        "kecamatan", "kabupaten", "desa", "kelurahan", "nomor", "no", "no.", 
        "rincian", "uraian", "kategori", "bulan", "hari", "provinsi", "kota",
        "sex", "jenis kelamin", "dimensi", "nama"
    ]
    if header_lower in ["", "-"]:
        return True
    return any(keyword in header_lower for keyword in dimension_keywords)

def extract_and_clean_header_unit(header: str, default_unit: str = "-") -> tuple:
    if not header:
        return "", default_unit
        
    header_clean = header.strip()
    
    # 1. Cari satuan di dalam tanda kurung
    match = re.search(r'\(([^)]+)\)', header_clean)
    if match:
        inside = match.group(1).strip()
        inside_lower = inside.lower()
        
        KNOWN_UNITS_MAP = {
            "persen": "%",
            "persentase": "%",
            "%": "%",
            "percent": "%",
            "jiwa": "Jiwa",
            "orang": "Jiwa",
            "rupiah": "Rupiah",
            "rupiahs": "Rupiah",
            "ribu rupiah": "Ribu Rupiah",
            "juta rupiah": "Juta Rupiah",
            "miliar rupiah": "Miliar Rupiah",
            "sekolah": "Sekolah",
            "guru": "Guru",
            "murid": "Siswa",
            "siswa": "Siswa",
            "desa": "Desa",
            "kelurahan": "Desa",
            "unit": "Unit",
            "ton": "Ton",
            "kuintal": "Kuintal",
            "kg": "Kg",
            "kilogram": "Kg",
            "hektar": "Hektar",
            "ha": "Hektar",
            "lembar": "Lembar",
            "buah": "Buah",
            "kilometer": "Km",
            "km": "Km",
            "meter": "Meter",
            "m": "Meter"
        }
        
        matched_unit = None
        for key in sorted(KNOWN_UNITS_MAP.keys(), key=len, reverse=True):
            if key in inside_lower:
                matched_unit = KNOWN_UNITS_MAP[key]
                break
                
        if matched_unit:
            header_without_unit = header_clean.replace(match.group(0), "").strip()
            header_without_unit = re.sub(r'\s*-\s*$', '', header_without_unit).strip()
            header_without_unit = re.sub(r'\s+', ' ', header_without_unit)
            if header_without_unit:
                return header_without_unit, matched_unit
            else:
                return header_clean, matched_unit
                
    # 2. Cari kata kunci di akhir kata secara langsung
    header_lower = header_clean.lower()
    RAW_UNITS_MAP = {
        "ribu rupiah": "Ribu Rupiah",
        "juta rupiah": "Juta Rupiah",
        "miliar rupiah": "Miliar Rupiah",
        "rupiah": "Rupiah",
        "persen": "%",
        "persentase": "%",
        "%": "%",
        "jiwa": "Jiwa",
        "sekolah": "Sekolah",
        "guru": "Guru",
        "siswa": "Siswa",
        "murid": "Siswa",
        "ton": "Ton",
        "kuintal": "Kuintal",
        "hektar": "Hektar",
        " unit": "Unit"
    }
    
    for key, mapped_val in sorted(RAW_UNITS_MAP.items(), key=lambda x: len(x[0]), reverse=True):
        pattern = r'\b' + re.escape(key) + r'\b'
        if re.search(pattern, header_lower):
            header_without_unit = re.sub(pattern, '', header_clean, flags=re.IGNORECASE).strip()
            header_without_unit = re.sub(r'\s*-\s*$', '', header_without_unit).strip()
            header_without_unit = re.sub(r'\s+', ' ', header_without_unit)
            if header_without_unit:
                return header_without_unit, mapped_val
            else:
                return header_clean, mapped_val
                
    return header_clean, default_unit

def deduplicate_columns(columns: List[str]) -> List[str]:
    seen = {}
    new_cols = []
    for col in columns:
        col_str = str(col).strip()
        if not col_str:
            col_str = "Kolom_Kosong"
        if col_str in seen:
            seen[col_str] += 1
            new_cols.append(f"{col_str}.{seen[col_str]}")
        else:
            seen[col_str] = 0
            new_cols.append(col_str)
    return new_cols
