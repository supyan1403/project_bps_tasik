import os
import re
import logging
import pandas as pd
import pdfplumber
from typing import List, Dict, Optional

def get_safe_windows_path(path: str) -> str:
    if os.name == 'nt':
        abs_path = os.path.abspath(path)
        if not abs_path.startswith("\\\\?\\"):
            return "\\\\?\\" + abs_path.replace("/", "\\")
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

ENGLISH_ONLY_WORDS = {
    'district', 'subdistrict', 'population', 'growth', 'rate', 'percentage', 'density',
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
    'restaurant', 'transport', 'communication', 'finance', 'services',
    'irrigation', 'irrigated', 'harvested', 'harvest', 'planted',
    'paddy', 'field', 'fields', 'land', 'dryland', 'wetland', 'rice', 'crop', 'crops',
    'production', 'productivity', 'yield', 'ton', 'hectare', 'ha',
    'food', 'estate', 'plantation', 'livestock', 'cattle', 'poultry',
    'fishery', 'aquaculture', 'capture', 'pond', 'sea', 'river',
    'school', 'education', 'health', 'poverty', 'household', 'family',
    'birth', 'death', 'marriage', 'divorce', 'infant', 'mortality',
    'expenditure', 'income', 'wage', 'salary', 'price', 'index',
    'consumer', 'goods', 'import', 'export', 'balance', 'account',
    'road', 'bridge', 'vehicle', 'car', 'motorcycle', 'bus', 'train',
    'airport', 'port', 'ship', 'passenger', 'cargo', 'unit',
    'not', 'average', 'gross', 'net', 'urban', 'rural',
    'public', 'private', 'government', 'region', 'national', 'local',
    'type', 'category', 'classification', 'description', 'item', 'code',
    'places', 'worship', 'religion', 'religious', 'mosque', 'mosques', 
    'church', 'churches', 'temple', 'temples', 'disaster', 'disasters', 'natural', 
    'landslide', 'flood', 'floods', 'earthquake', 'drought', 'fire', 'fires', 
    'villages', 'subdistricts', 'districts', 'regencies', 'municipalities', 
    'cities', 'provinces', 'states', 'countries', 'square', 'kilometer', 
    'kilometers', 'populations', 'males', 'females', 'ratios', 'densities', 
    'growths', 'rates', 'percentages', 'ages', 'groupings', 'structures', 
    'distributions', 'households', 'members', 'marital', 'married', 'single', 
    'divorced', 'widowed', 'educations', 'schools', 'students', 'teachers', 
    'classes', 'classrooms', 'hospitals', 'clinics', 'centers', 'medical', 
    'doctors', 'nurses', 'midwives', 'pharmacies', 'diseases', 'patients', 
    'poverties', 'poors', 'welfares', 'expenditures', 'incomes', 'consumptions', 
    'nonfood', 'labors', 'forces', 'employments', 'unemployments', 'employees', 
    'workers', 'agricultures', 'farms', 'farmers', 'lands', 'holdings', 
    'maize', 'corn', 'cassava', 'sweet', 'potato', 'potatoes', 'vegetables', 
    'fruits', 'livestocks', 'poultries', 'chickens', 'cows', 'goats', 'sheeps', 
    'buffaloes', 'horses', 'fisheries', 'fishes', 'fishermen', 'marines', 
    'inlands', 'ponds', 'cages', 'productions', 'harvests', 'yields', 
    'productivities', 'industries', 'manufacturings', 'establishments', 
    'trades', 'retails', 'wholesales', 'markets', 'hotels', 'restaurants', 
    'tourisms', 'tourists', 'visits', 'arrivals', 'occupancies', 'transports', 
    'transportations', 'roads', 'lengths', 'paved', 'unpaved', 'asphalt', 
    'gravel', 'dirt', 'vehicles', 'cars', 'motorcycles', 'buses', 'trucks', 
    'trains', 'railways', 'airports', 'flights', 'passengers', 'cargos', 
    'ships', 'ports', 'posts', 'offices', 'telecommunications', 'telephones', 
    'mobiles', 'cellulars', 'internets', 'users', 'finances', 'bankings', 
    'banks', 'credits', 'deposits', 'savings', 'cooperatives', 'inflations', 
    'prices', 'indexes', 'consumers', 'revenues', 'expenditures', 'budgets', 
    'taxes', 'grants', 'grosses', 'regionals', 'domestics', 'products', 
    'gdps', 'constants', 'currents', 'sectors', 'origins', 'origin',
    'civil', 'servant', 'servants', 'government', 'officer', 'officers',
    'level', 'levels', 'status', 'statuses', 'conditions', 'condition',
    'facilities', 'facility', 'availabilities', 'availability', 'available',
    'infrastructure', 'infrastructures', 'village-level', 'village_level',
    'distance', 'distances', 'capital', 'capitals', 'office', 'offices',
    'location', 'locations', 'height', 'heights', 'sea', 'land', 'elevation',
    'elevations', 'geographical', 'geographic', 'slopes', 'slope',
    'soil', 'soils', 'type', 'types', 'weather', 'climate', 'rainfall',
    'rainy', 'dry', 'season', 'seasons', 'temperature', 'temperatures',
    'humidity', 'humidities', 'wind', 'winds', 'speed', 'speeds',
    'pressure', 'pressures', 'station', 'stations', 'meteorological',
    'geophysical', 'climatological', 'climatology', 'geophysics',
    'earthquakes', 'tsunamis', 'tsunami', 'volcanic', 'volcano', 'volcanoes',
    'eruption', 'eruptions', 'landslides', 'floods', 'inundation', 'inundations',
    'forest', 'forests', 'land', 'use', 'uses', 'utilization', 'utilizations'
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
    'sep', 'september', 'okt', 'oktober', 'nov', 'nopember', 'des', 'desember',
    'pns', 'tni', 'polri', 'sekolah', 'guru', 'murid', 'puskesmas', 'posyandu', 
    'sakit', 'klinik', 'agama', 'masjid', 'mushola', 'gereja', 'pura', 'wihara', 
    'bencana', 'alam', 'kemiskinan', 'miskin', 'pengeluaran', 'pendapatan', 
    'pertanian', 'lahan', 'sawah', 'produksi', 'panen', 'tanaman', 'ternak', 
    'perikanan', 'jalan', 'panjang', 'kendaraan', 'mobil', 'motor', 'bank', 
    'koperasi', 'pasar', 'harga', 'inflasi', 'pdrb', 'sektor', 'kategori', 
    'sumber', 'catatan', 'keterangan', 'asli', 'daerah', 'retribusi', 'pajak',
    'pegawai', 'negeri', 'sipil', 'swasta', 'wiraswasta', 'tani', 'nelayan',
    'pria', 'wanita', 'umur', 'golongan', 'pendidikan', 'sd', 'smp', 'sma',
    'smk', 'mi', 'mts', 'ma', 'universitas', 'diploma', 'sarjana', 'lulusan',
    'fasilitas', 'sarana', 'prasarana', 'listrik', 'air', 'bersih', 'sanitasi',
    'jembatan', 'aspal', 'kerikil', 'tanah', 'rusak', 'baik', 'sedang', 'berat',
    'penyakit', 'kesehatan', 'medis', 'dokter', 'perawat', 'bidan', 'obat'
}

def recalculate_total_row(df: pd.DataFrame, total_row: pd.Series) -> pd.Series:
    """
    Menghitung ulang nilai total baris secara otomatis berdasarkan penjumlahan data di df.
    Mengabaikan kolom yang terdeteksi sebagai persentase, rasio, laju pertumbuhan, kepadatan, dsb.
    """
    new_total = total_row.copy()
    # Kolom pertama dipaksa menjadi "Total"
    new_total.iloc[0] = "Total"
    
    for i in range(1, len(df.columns)):
        col_name = str(df.columns[i])
        
        # Deteksi kolom persentase, rasio, laju pertumbuhan, kepadatan
        is_ratio_col = any(k in col_name.lower() for k in [
            'persen', 'persentase', 'rasio', 'ratio', 'laju', 'pertumbuhan', 
            'kepadatan', 'density', 'rate', 'percentage', 'rata-rata', 'average', 
            'indeks', 'index', 'ipm', 'hdi'
        ])
        
        if is_ratio_col:
            # Tetap gunakan nilai asli dari PDF jika kolom bertipe rasio/persentase
            continue
            
        col_values = df.iloc[:, i]
        parsed_vals = []
        has_decimals = False
        decimal_places = 0
        use_comma_decimal = False
        
        for val in col_values:
            val_str = str(val).strip()
            if not val_str or val_str in ['-', '', 'nan', 'None']:
                continue
            
            # Deteksi format desimal koma vs titik
            if ',' in val_str and '.' in val_str:
                if val_str.find('.') < val_str.find(','):
                    use_comma_decimal = True
            elif ',' in val_str:
                use_comma_decimal = True
                
            # Hitung jumlah tempat desimal
            if use_comma_decimal and ',' in val_str:
                parts = val_str.split(',')
                if len(parts) == 2:
                    dec_part = re.sub(r'[^\d]', '', parts[1])
                    decimal_places = max(decimal_places, len(dec_part))
                    has_decimals = True
            elif '.' in val_str:
                parts = val_str.split('.')
                if len(parts) == 2:
                    dec_part = re.sub(r'[^\d]', '', parts[1])
                    # Abaikan jika terlihat seperti ribuan biasa (panjang 3)
                    if len(dec_part) != 3 or col_values.apply(lambda x: '.' in str(x)).sum() == 1:
                        decimal_places = max(decimal_places, len(dec_part))
                        has_decimals = True
            
            parsed = parse_indonesian_number(val_str)
            if parsed is not None:
                parsed_vals.append(parsed)
        
        if parsed_vals:
            col_sum = sum(parsed_vals)
            
            if not has_decimals:
                # Format integer
                has_dots = any('.' in str(x) for x in col_values if str(x).strip() not in ['-', ''])
                if has_dots:
                    new_total.iloc[i] = f"{int(round(col_sum)):,}".replace(',', '.')
                else:
                    new_total.iloc[i] = str(int(round(col_sum)))
            else:
                # Format desimal
                fmt_str = f"{{:.{decimal_places}f}}"
                formatted_val = fmt_str.format(col_sum)
                if use_comma_decimal:
                    formatted_val = formatted_val.replace('.', ',')
                new_total.iloc[i] = formatted_val
                
    return new_total

def clean_text_cell(val: str) -> str:
    """
    Remove English translations from table cells/values, handling both newlines and slashes.
    """
    if not val:
        return val
    
    val = str(val).strip()
    
    # Split by newline first, as BPS often puts English translations on new lines
    lines = val.split('\n')
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

def extract_table_number(page_text: str, page_num: Optional[int] = None, pdf_path: Optional[str] = None) -> Optional[str]:
    if not page_text:
        return None
        
    def check_bps_2025_typo(num: str) -> str:
        import os
        if pdf_path and "2025" in os.path.basename(pdf_path) and page_num:
            if 387 <= page_num <= 399:
                if num.startswith("1.3."):
                    num = num.replace("1.3.", "11.1.", 1)
                elif num.startswith("1.4."):
                    num = num.replace("1.4.", "11.2.", 1)
                elif num == "1.3":
                    num = "11.1"
                elif num == "1.4":
                    num = "11.2"
        return num

    def is_valid_table_num(num: str) -> bool:
        # Hapus akhiran huruf jika ada
        clean_num = re.sub(r'[a-zA-Z]$', '', num)
        parts = clean_num.split('.')
        if len(parts) < 2 or len(parts) > 3:
            return False
        for p in parts:
            if not p.isdigit():
                return False
            val = int(p)
            # Setiap bagian nomor tabel BPS Tasikmalaya bernilai antara 1 dan 99
            if val < 1 or val > 99:
                return False
        return True

    # 1. Cari pola "Tabel/Table <nomor>" (wajib bertitik desimal minimal 2 tingkat, misal 1.1)
    for match in re.finditer(r'(?:Tabel|Table)[\s\S]{0,150}?(\d+\s*\.\s*\d+(?:\s*\.\s*\d+)*[a-zA-Z]?)', page_text, re.IGNORECASE):
        num = re.sub(r'\s+', '', match.group(1))
        if is_valid_table_num(num):
            return check_bps_2025_typo(num)
    
    # 2. Fallback: cari angka standalone yang mengandung titik (harus bertitik agar tidak sembarang angka terpilih)
    for match in re.finditer(r'\b(\d+(?:\s*\.\s*\d+){1,3}[a-zA-Z]?)\b', page_text):
        num = re.sub(r'\s+', '', match.group(1))
        if '.' in num and is_valid_table_num(num):
            return check_bps_2025_typo(num)
            
    return None

def is_dimension_column(header: str) -> bool:
    if not header:
        return True
    header_lower = header.strip().lower()
    if header_lower in ["", "-"]:
        return True

    if re.search(r"\bno\.?\b", header_lower) and header_lower.startswith("no"):
        return True

    prefix_keywords = [
        "kecamatan", "kabupaten", "desa", "kelurahan", "nomor",
        "rincian", "uraian", "kategori", "bulan", "hari", "provinsi",
        "jenis kelamin", "jenis pendapatan", "dimensi", "nama",
    ]
    for kw in prefix_keywords:
        if header_lower == kw or header_lower.startswith(kw + " ") or header_lower.startswith(kw + "/"):
            return True
    return False


_PAGE_REF_KEYWORDS = ("hal", "page", "lanjut", "continued")

# Alias satuan BPS: urutan dari yang paling spesifik ke umum
UNIT_ALIASES = [
    ("km2/sq.km", "Km²"),
    ("km²/sq.km", "Km²"),
    ("jiwa/km²", "Jiwa/Km²"),
    ("jiwa/km2", "Jiwa/Km²"),
    ("ribu rupiah", "Ribu Rupiah"),
    ("juta rupiah", "Juta Rupiah"),
    ("miliar rupiah", "Miliar Rupiah"),
    ("m a.s.l", "mdpl"),
    ("persentase", "%"),
    ("kilogram", "Kg"),
    ("kilometer", "Km"),
    ("hektar", "Hektar"),
    ("kuintal", "Kuintal"),
    ("kelurahan", "Desa"),
    ("tangkai", "Tangkai"),
    ("rupiahs", "Rupiah"),
    ("persen", "%"),
    ("percent", "%"),
    ("mdpl", "mdpl"),
    ("kwh", "KWH"),
    ("sq.km", "Km²"),
    ("rupiah", "Rupiah"),
    ("sekolah", "Sekolah"),
    ("orang", "Jiwa"),
    ("meter", "Meter"),
    ("lembar", "Lembar"),
    ("murid", "Siswa"),
    ("siswa", "Siswa"),
    ("jiwa", "Jiwa"),
    ("guru", "Guru"),
    ("desa", "Desa"),
    ("km²", "Km²"),
    ("km2", "Km²"),
    ("buah", "Buah"),
    ("unit", "Unit"),
    ("ton", "Ton"),
    ("ha", "ha"),
    ("km", "Km"),
    ("kg", "Kg"),
    ("%", "%"),
]

COLUMN_UNIT_RULES = [
    (r"jumlah\s+sekolah|\bsekolah\b", "Sekolah"),
    (r"jumlah\s+guru|\bguru\b", "Guru"),
    (r"jumlah\s+murid|jumlah\s+siswa|\bmurid\b|\bsiswa\b", "Siswa"),
    (r"kepadatan", "Jiwa/Km²"),
    (r"jumlah\s+penduduk|\bpenduduk\b", "Jiwa"),
    (r"laju\s+pertumbuhan|pertumbuhan\s+penduduk", "%"),
    (r"distribusi\s+persentase|persentase\s+terhadap|\bpersentase\b", "%"),
    (r"\brasio\b", "-"),
    (r"jumlah\s+pulau|\bpulau\b", "Buah"),
    (r"tinggi\s+wilayah|\bmdpl\b|altitude", "mdpl"),
    (r"jarak\s+ke\s+ibukota|\bjarak\b", "Km"),
    (r"listrik\s+terjual|\bkwh\b", "KWH"),
    (r"daya\s+terpasang", "KVA"),
    (r"\bluas\b|\barea\b", None),
]


def _is_non_unit_paren(content: str) -> bool:
    c = content.strip().lower()
    if any(x in c for x in _PAGE_REF_KEYWORDS):
        return True
    if re.search(r"\b20\d{2}\b", c):
        return True
    return False


def normalize_unit_text(raw: str) -> Optional[str]:
    if not raw or not str(raw).strip():
        return None
    text = str(raw).strip().lower()
    text = text.replace("²", "2").replace("³", "3")
    text = re.sub(r"\s+", " ", text)

    for alias, normalized in UNIT_ALIASES:
        if len(alias) <= 3:
            tokens = re.split(r"[/\s,]+", text)
            if text == alias or alias in tokens:
                return normalized
        elif alias in text:
            return normalized

    if len(text) <= 25 and not re.search(r"\b20\d{2}\b", text):
        return str(raw).strip()
    return None


def extract_units_from_parentheses(text: str) -> List[tuple]:
    results = []
    for match in re.finditer(r"\(([^)]+)\)", text):
        content = match.group(1).strip()
        if _is_non_unit_paren(content):
            continue
        unit = normalize_unit_text(content)
        if unit:
            results.append((content, unit))

    broken = re.search(r"\(([^)]+)$", text.strip())
    if broken:
        content = broken.group(1).strip()
        if not _is_non_unit_paren(content):
            unit = normalize_unit_text(content)
            if unit and not any(u[1] == unit for u in results):
                results.append((content, unit))
    return results


def extract_title_table_unit(table_name: str) -> Optional[str]:
    candidates = []
    for match in re.finditer(r"\(([^)]+)\)", table_name):
        content = match.group(1).strip()
        if _is_non_unit_paren(content):
            continue
        unit = normalize_unit_text(content)
        if unit:
            candidates.append(unit)
    return candidates[-1] if candidates else None


def extract_title_unit_keyword_hints(table_name: str) -> Dict[str, str]:
    hints = {}
    title = table_name.lower()
    phrase_patterns = [
        (r"tinggi\s+wilayah\s*\(([^)]+)\)", "tinggi"),
        (r"jarak[^)]*\(([^)]+)\)", "jarak"),
        (r"luas\s+(?:daerah|lahan|panen)?[^)]*\(([^)]+)\)", "luas"),
    ]
    for pattern, keyword in phrase_patterns:
        m = re.search(pattern, title, re.IGNORECASE)
        if m and not _is_non_unit_paren(m.group(1)):
            unit = normalize_unit_text(m.group(1))
            if unit:
                hints[keyword] = unit
    return hints


def detect_column_unit(header: str, table_name: str, table_unit: Optional[str]) -> Optional[str]:
    header_lower = header.lower()

    paren_units = extract_units_from_parentheses(header)
    if paren_units:
        return paren_units[-1][1]

    for keyword, unit in extract_title_unit_keyword_hints(table_name).items():
        if keyword in header_lower:
            return unit

    for pattern, unit in COLUMN_UNIT_RULES:
        if re.search(pattern, header_lower, re.IGNORECASE):
            if unit is None:
                return table_unit
            return unit

    return None


def clean_header_remove_units(header: str) -> str:
    header_clean = header.strip()
    if not header_clean:
        return header_clean

    cleaned = header_clean
    for match in re.finditer(r"\(([^)]+)\)", cleaned):
        if normalize_unit_text(match.group(1)):
            cleaned = cleaned.replace(match.group(0), " ")
    cleaned = re.sub(r"\([^)]+$", "", cleaned)
    cleaned = re.sub(r"\s*-\s*$", "", cleaned).strip()
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or header_clean


def extract_and_clean_header_unit(header: str, default_unit: str = "-") -> tuple:
    if not header:
        return "", default_unit

    header_clean = header.strip()
    col_unit = detect_column_unit(header_clean, "", None) or default_unit
    cleaned = clean_header_remove_units(header_clean)
    return cleaned, col_unit

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

def detect_and_clean_metadata(table_name: str, doc_year: int, headers: List[str]) -> tuple:
    units = [""] * len(headers)
    years = [""] * len(headers)
    cleaned_headers = []
    table_unit = extract_title_table_unit(table_name)

    range_match = re.search(r'\b(20\d{2})\s*[-–]\s*(20\d{2})\b', table_name)
    school_year_matches = re.findall(r'\b(20\d{2}/20\d{2})\b', table_name)
    years_in_title = re.findall(r'\b(20\d{2})\b', table_name)

    clean_years_in_title = []
    for y in years_in_title:
        in_range = False
        if range_match and (range_match.group(1) == y or range_match.group(2) == y):
            in_range = True
        for sy in school_year_matches:
            if y in sy:
                in_range = True
        if not in_range:
            clean_years_in_title.append(y)

    for idx, header in enumerate(headers):
        header_clean = header.strip()

        if idx == 0 or is_dimension_column(header_clean):
            cleaned_headers.append(header_clean)
            units[idx] = "-"
            years[idx] = "-"
            continue

        col_unit = detect_column_unit(header_clean, table_name, table_unit)
        if col_unit is None:
            col_unit = table_unit if table_unit else "-"

        cleaned_h = clean_header_remove_units(header_clean)
        cleaned_headers.append(cleaned_h)

        col_year = "-"
        year_in_header = re.search(r'\b(20\d{2}(?:\s*[-–/]\s*(?:20)?\d{2})?)\b', cleaned_h)
        if year_in_header:
            col_year = year_in_header.group(1)
        elif range_match:
            start_yr = int(range_match.group(1))
            end_yr = int(range_match.group(2))
            try:
                val_int = int(cleaned_h)
                if start_yr <= val_int <= end_yr:
                    col_year = str(val_int)
            except ValueError:
                for yr in range(start_yr, end_yr + 1):
                    if str(yr) in cleaned_h:
                        col_year = str(yr)
                        break
        elif len(school_year_matches) > 1:
            for sy in school_year_matches:
                if sy in cleaned_h:
                    col_year = sy
                    break

        if col_year == "-":
            if len(school_year_matches) == 1:
                col_year = school_year_matches[0]
            elif len(clean_years_in_title) == 1:
                col_year = clean_years_in_title[0]
            else:
                col_year = str(doc_year)

        years[idx] = col_year
        units[idx] = col_unit

    deduplicated_headers = deduplicate_columns(cleaned_headers)

    if len(units) > 0:
        units[0] = "satuan"
    if len(years) > 0:
        years[0] = "tahun"

    return deduplicated_headers, units, years

def clean_title_description(raw_lines: List[str], table_number: Optional[str] = None) -> str:
    clean_lines = []
    tnum_escaped = make_table_number_pattern(table_number) if table_number else ""
    
    for line in raw_lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        
        # Remove "Tabel", "Table", "Lanjutan" prefix if present at start of line, optionally followed by table number
        pattern = r'^(?:Lanjutan\s+|Continued\s+)?(?:Tabel|Table)(?:\s+' + tnum_escaped + r')?\s*' if tnum_escaped else r'^(?:Tabel|Table|Lanjutan)\s+'
        line_clean = re.sub(pattern, '', line_clean, flags=re.IGNORECASE)
        
        # Handle generic table number cleanup if it's on a line by itself
        if table_number and (line_clean.strip() == table_number or re.sub(r'\s+', '', line_clean.strip()) == table_number):
            continue
            
        # Clean up leading/trailing slash or spaces
        line_clean = line_clean.strip('/ \t\n\r')
        
        if not line_clean:
            continue
            
        # Hapus kata-kata watermark BPS
        for w in ['tasikmalayakab', 'bps', 'go', 'id', 'tasikmalayakabbpsgoid']:
            line_clean = re.sub(rf'\b{w}\b', '', line_clean, flags=re.IGNORECASE)
            
        # Hapus huruf-huruf aneh tunggal yang tersisa dari watermark
        line_clean = re.sub(r'\b[a-z]\b', '', line_clean)
        line_clean = re.sub(r'\s+', ' ', line_clean).strip()
        
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
            
        # Periksa apakah line_clean adalah bahasa Inggris
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
        
    joined_title = " ".join(clean_lines).strip()
    
    # Hapus nomor tabel yang mungkin terselip di dalam teks (karena kesalahan urutan baca PDF)
    if table_number:
        tnum_pat = make_table_number_pattern(table_number)
        joined_title = re.sub(r'\b' + tnum_pat + r'\b', '', joined_title, flags=re.IGNORECASE)
    # Hapus sisa pecahan angka desimal (seperti "1.1.3" atau "1.1" dengan spasi)
    joined_title = re.sub(r'\b\d+\s*\.\s*\d+(?:\s*\.\s*\d+)?\b', ' ', joined_title)
    # Hapus titik ganda/bising (seperti "..3" atau "..")
    joined_title = re.sub(r'\.+\s*\d+\b', ' ', joined_title)
    # Bersihkan sisa titik ganda yang tidak terhapus
    joined_title = re.sub(r'\s*\.{2,}\s*', ' ', joined_title)
    # Hapus kata "Tabel" atau "Table" yang mungkin tertinggal di tengah, termasuk yang terpisah spasi
    joined_title = re.sub(r'\b(?:Tabel|Table|T\s*a\s*b\s*e\s*l|T\s*a\s*b\s*l\s*e)\b', '', joined_title, flags=re.IGNORECASE)
    
    words_list = joined_title.split()
    unique_words = []
    for w in words_list:
        if not unique_words or w.lower() != unique_words[-1].lower():
            unique_words.append(w)
    return " ".join(unique_words)

def apply_modifications(df: pd.DataFrame, mods: Dict) -> pd.DataFrame:
    """
    Applies row and column modifications to a DataFrame based on a configuration.
    Supports both integer-based and data-aware positioning.
    """
    if not isinstance(df, pd.DataFrame):
        return df

    # --- Apply Column Additions ---
    if "add_columns" in mods:
        cols_to_insert = []
        
        # 1. Resolve all column positions into a list of (index, name, values)
        for col_mod in mods["add_columns"]:
            name = col_mod.get("name")
            if not name or name in df.columns:
                logging.warning(f"Skipping adding column '{name}' (name missing or already exists).")
                continue

            pos_config = col_mod.get("position", "end")
            idx = -1

            if pos_config == "start":
                idx = 0
            elif pos_config == "end":
                idx = len(df.columns)
            elif isinstance(pos_config, int):
                idx = pos_config
            elif isinstance(pos_config, dict):
                try:
                    col_list = list(df.columns)
                    if "after_column" in pos_config:
                        target_col = pos_config["after_column"]
                        target_idx = col_list.index(target_col)
                        idx = target_idx + 1
                    elif "before_column" in pos_config:
                        target_col = pos_config["before_column"]
                        idx = col_list.index(target_col)
                    else:
                        logging.warning(f"Invalid column position config for '{name}': {pos_config}")
                except (ValueError, KeyError) as e:
                    logging.error(f"Could not find target column for '{name}': {e}. Skipping.")
            else:
                logging.warning(f"Unknown position type '{pos_config}' for column '{name}'. Skipping.")

            if idx != -1:
                # Prepare column data
                num_rows = len(df)
                values_config = col_mod.get("values", "")
                if isinstance(values_config, list) and len(values_config) == num_rows:
                    col_data = values_config
                elif values_config == "range":
                    col_data = range(1, num_rows + 1)
                else:  # Broadcast a single value
                    col_data = [values_config] * num_rows
                
                cols_to_insert.append((idx, name, col_data))

        # 2. Sort by index descending and insert
        cols_to_insert.sort(key=lambda x: x[0], reverse=True)
        for idx, name, values in cols_to_insert:
            # Clamp index to be within bounds
            final_idx = min(idx, len(df.columns))
            df.insert(final_idx, name, values)
            logging.info(f"Inserted column '{name}' at index {final_idx}.")

    # Short-circuit if DataFrame becomes empty (e.g. via modifications)
    if df.empty:
        return df

    # --- Apply Row Additions ---
    if "add_rows" in mods:
        rows_to_insert = []

        # 1. Resolve all row positions into a list of (index, data)
        for row_mod in mods["add_rows"]:
            data = row_mod.get("data", {})
            pos_config = row_mod.get("position", "end")
            idx = -1

            if pos_config == "start":
                idx = 0
            elif pos_config == "end":
                idx = len(df)
            elif isinstance(pos_config, int):
                idx = pos_config
            elif isinstance(pos_config, dict):
                try:
                    if "after_row" in pos_config:
                        target_spec = pos_config["after_row"]
                        target_col, target_val = target_spec["column"], target_spec["value"]
                        # Find first match, convert both to string for safe comparison
                        matches = df.index[df[target_col].astype(str) == str(target_val)].tolist()
                        if matches:
                            idx = matches[0] + 1
                        else:
                            logging.warning(f"Could not find row where '{target_col}' is '{target_val}'. Appending to end.")
                            idx = len(df)
                    elif "before_row" in pos_config:
                        target_spec = pos_config["before_row"]
                        target_col, target_val = target_spec["column"], target_spec["value"]
                        matches = df.index[df[target_col].astype(str) == str(target_val)].tolist()
                        if matches:
                            idx = matches[0]
                        else:
                            logging.warning(f"Could not find row where '{target_col}' is '{target_val}'. Appending to end.")
                            idx = len(df)
                    else:
                        logging.warning(f"Invalid row position config: {pos_config}. Appending to end.")
                        idx = len(df)
                except KeyError as e:
                    logging.error(f"Invalid key in row position config: {e}. Appending to end.")
                    idx = len(df)
            else:
                logging.warning(f"Unknown position type '{pos_config}' for row. Appending to end.")
                idx = len(df)

            if idx != -1:
                rows_to_insert.append((idx, data))

        # 2. Sort by index descending and insert
        rows_to_insert.sort(key=lambda x: x[0], reverse=True)
        for idx, data in rows_to_insert:
            row_df = pd.DataFrame([data])
            # Clamp index
            final_idx = min(idx, len(df))
            df = pd.concat([df.iloc[:final_idx], row_df, df.iloc[final_idx:]]).reset_index(drop=True)
            logging.info(f"Inserted row at index {final_idx}.")
            
    # Final cleanup of NaNs that may have been introduced
    df.fillna("", inplace=True)

    return df

# Konfigurasi logging
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

                if not table_num:
                    logging.info(f"-> Halaman {actual_page} DIABAIKAN. Alasan: Tidak terdeteksi nomor tabel (Cover/Halaman penjelasan/Bukan tabel statistik).")
                    continue

                # --- MANUAL OVERRIDE UNTUK TYPO BPS (BERDASARKAN HALAMAN PDF 2026) ---
                if pdf_path and "2026" in os.path.basename(pdf_path):
                    if actual_page in [293, 294]:
                        table_num = "6.1.1"
                    elif actual_page == 296:
                        table_num = "6.1.2"
                    elif actual_page == 299:
                        table_num = "6.2.1"
                    elif actual_page in [303, 304]:
                        table_num = "6.3.1_Bagian_1"
                    elif actual_page in [305, 306]:
                        table_num = "6.3.1_Bagian_2"
                # -----------------------------------------------------------------

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
                # ALGORITMA MERGING CERDAS DUA TAHAP (HORIZONTAL & VERTIKAL)
                # -------------------------------------------------------------
                # Tahap 1: Gabungkan secara HORIZONTAL (Kolom sampingan)
                temp_categories = []
                for res in results:
                    df = res['dataframe'].copy()
                    
                    # Bersihkan kolom bising "Kolom_Kosong" yang tidak berisi data
                    for col in list(df.columns):
                        if str(col).startswith("Kolom_Kosong"):
                            # Cek apakah nilai di bawah metadata (satuan dan tahun) bernilai kosong/NaN
                            data_slice = df[col].iloc[2:] if len(df) > 2 else df[col]
                            is_empty = data_slice.isna().all() or data_slice.astype(str).str.strip().replace(['nan', '-', ''], None).isna().all()
                            if is_empty:
                                df = df.drop(columns=[col])
                                
                    table_num = res.get('table_number')
                    pages = [res['page']]
                    is_merged = False
                    
                    for prev in temp_categories:
                        if table_num and prev.get('table_number') and table_num != prev['table_number']:
                            continue
                        prev_df = prev['dataframe']
                        
                        # Gabung horizontal jika jumlah baris sama dan nilai kolom pertama (Kecamatan) mirip (toleransi OCR)
                        if len(df) == len(prev_df) and len(df) > 0:
                            import re
                            matching_rows = 0
                            for r_idx in range(len(df)):
                                val1 = re.sub(r'[^a-zA-Z0-9]', '', str(df.iloc[r_idx, 0])).lower()
                                val2 = re.sub(r'[^a-zA-Z0-9]', '', str(prev_df.iloc[r_idx, 0])).lower()
                                if val1 == val2 or (val1 and val2 and (val1 in val2 or val2 in val1)):
                                    matching_rows += 1
                            
                            if (matching_rows / len(df)) >= 0.8:
                                df_right = df.iloc[:, 1:].copy()
                                prev['dataframe'] = pd.concat([prev_df, df_right], axis=1)
                                prev['pages'].extend(pages)
                                prev['has_horizontal_join'] = True
                                is_merged = True
                                break
                                
                    if not is_merged:
                        temp_categories.append({
                            "table_number": table_num,
                            "dataframe": df,
                            "pages": pages,
                            "index_row": res.get("index_row", []),
                            "has_horizontal_join": False
                        })

                # Tahap 2: Gabungkan secara VERTIKAL (Baris lanjutan)
                merged_categories = []
                for temp in temp_categories:
                    df = temp['dataframe']
                    table_num = temp.get('table_number')
                    pages = temp['pages']
                    is_merged = False
                    
                    for prev in merged_categories:
                        # --- AUTO-MERGE: Paksa gabung jika nomor tabel sama ---
                        forced_merge = False
                        if table_num and prev.get('table_number') and table_num == prev.get('table_number'):
                            forced_merge = True

                        if forced_merge or (table_num and prev.get('table_number') and table_num != prev['table_number']):
                            if not forced_merge:
                                continue
                            
                        prev_df = prev['dataframe']
                        
                        # Gabung vertikal jika kolomnya cocok (jumlah kolom sama dan nama mirip) atau jika nomor tabel sama dan jumlah kolom sama
                        match_found = False
                        if forced_merge:
                            match_found = True
                        elif len(df.columns) == len(prev_df.columns):
                            match_found = True
                            for k in range(min(2, len(df.columns))):
                                c1 = str(df.columns[k]).strip().lower()
                                c2 = str(prev_df.columns[k]).strip().lower()
                                if c1[:15] != c2[:15]:
                                    match_found = False
                                    break
                            
                        if match_found:
                            # Jika jumlah kolom berbeda saat dipaksa merge, lakukan alignment agar concat tidak gagal/eror
                            if len(df.columns) != len(prev_df.columns):
                                logging.info(f"Forced Merge: Aligning columns from {len(df.columns)} to {len(prev_df.columns)}")
                                if len(df.columns) < len(prev_df.columns):
                                    # Tambahkan kolom kosong
                                    for i in range(len(prev_df.columns) - len(df.columns)):
                                        df[f"_temp_col_{i}"] = ""
                                else:
                                    # Pangkas kolom lebih
                                    df = df.iloc[:, :len(prev_df.columns)]
                            
                            df.columns = prev_df.columns
                            prev['dataframe'] = pd.concat([prev_df, df], ignore_index=True)
                            prev['pages'].extend(pages)
                            # Lanjutkan status has_horizontal_join dari parent
                            is_merged = True
                            break
                                
                    if not is_merged:
                        merged_categories.append({
                            "category_id": len(merged_categories) + 1,
                            "table_number": table_num,
                            "dataframe": df,
                            "pages": pages,
                            "index_row": temp.get("index_row", [])
                        })
                    
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
                                        if len(title_safe) > 100:
                                            import re
                                            hal_match = re.search(r'\s*\(Hal\s+[\d,\s]+\)$', title_safe)
                                            hal_suffix = hal_match.group(0) if hal_match else ''
                                            allowed_desc_len = 100 - len(f'Tabel {table_number} - ') - len(hal_suffix) - 5
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
                                        try:
                                            # Hitung ulang baris total secara otomatis
                                            recalced_row = recalculate_total_row(df_to_save, row_vals)
                                            formatted_row = list(recalced_row)
                                        except Exception as e:
                                            print(f"[-] Gagal menghitung ulang baris total otomatis: {e}")
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
