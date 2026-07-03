import os
import re
import logging
import pandas as pd
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
    if len(text) < 5:
        return text
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
    'apr', 'april', 'mei', 'juni', 'juni', 'juli', 'juli', 'agt', 'agustus',
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
    Menghitung ulang nilai baris total:
    - Kolom biasa: dijumlah (sum)
    - Kolom rasio/persen: dirata-rata (mean)
    Label dipaksa menjadi "Total".
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
            if is_ratio_col:
                # Untuk kolom rasio/persen: gunakan rata-rata (mean), bukan jumlah
                col_val = sum(parsed_vals) / len(parsed_vals)
            else:
                col_val = sum(parsed_vals)
            
            if not has_decimals:
                # Format integer
                has_dots = any('.' in str(x) for x in col_values if str(x).strip() not in ['-', ''])
                if has_dots:
                    new_total.iloc[i] = f"{int(round(col_val)):,}".replace(',', '.')
                else:
                    new_total.iloc[i] = str(int(round(col_val)))
            else:
                # Format desimal
                fmt_str = f"{{:.{decimal_places}f}}"
                formatted_val = fmt_str.format(col_val)
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
        for idx, p in enumerate(parts):
            if not p.isdigit():
                return False
            # BPS table number parts are at most 2 digits long
            if len(p) > 2:
                return False
            val = int(p)
            # Setiap bagian nomor tabel BPS Tasikmalaya bernilai antara 1 dan 99
            if val < 1 or val > 99:
                return False
            # Bab (bagian pertama nomor tabel) maksimal bernilai 15
            if idx == 0 and val > 15:
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
    # Pastikan tidak ada NaN/None di headers
    headers = [str(h) if h is not None and str(h).lower() not in ['nan', 'none'] else "" for h in headers]
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

    # Safety: pastikan tidak ada NaN/None dalam years dan units
    years = [str(y) if y is not None and str(y).lower() not in ['nan', 'none'] else "" for y in years]
    units = [str(u) if u is not None and str(u).lower() not in ['nan', 'none'] else "" for u in units]

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
    # Hapus sisa pecahan angka desimal (seperti "1.1.3" or "1.1" dengan spasi)
    joined_title = re.sub(r'\b\d+\s*\.\s*\d+(?:\s*\.\s*\d+)?\b', ' ', joined_title)
    # Hapus titik ganda/bising (seperti "..3" or "..")
    joined_title = re.sub(r'\.+\s*\d+\b', ' ', joined_title)
    # Bersihkan sisa titik ganda yang tidak terhapus
    joined_title = re.sub(r'\s*\.{2,}\s*', ' ', joined_title)
    # Hapus kata "Tabel" atau "Table" yang mungkin tertinggal di tengah
    joined_title = re.sub(r'\b(?:Tabel|Table)\b', '', joined_title, flags=re.IGNORECASE)
    
    words_list = joined_title.split()
    unique_words = []
    for w in words_list:
        if not unique_words or w.lower() != unique_words[-1].lower():
            unique_words.append(w)
    return " ".join(unique_words)

def combine_similar_columns(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    
    cols = list(df.columns)
    
    def clean_col_name(c):
        s = str(c).lower().strip()
        # Remove continuation indicators
        s = re.sub(r'\b(lanjutan|continued)\b', '', s)
        # Hapus pengulangan frase tahun + unit terduplikasi (misal: 2020-2022 (%) 2020-2022 (%))
        s = re.sub(r'(\b20\d{2}\b.*?)\s*\1', r'\1', s)
        # Hapus kata-kata duplikat berturut-turut
        words = s.split()
        unique_words = []
        for w in words:
            if not unique_words or w != unique_words[-1]:
                unique_words.append(w)
        s = " ".join(unique_words)
        s = re.sub(r'[^a-z0-9]', '', s) # Keep only alphanumeric characters
        return s
        
    normalized = {c: clean_col_name(c) for c in cols}
    
    cols_to_drop = set()
    
    for i in range(len(cols)):
        if cols[i] in cols_to_drop:
            continue
        for j in range(i + 1, len(cols)):
            if cols[j] in cols_to_drop:
                continue
            ni, nj = normalized[cols[i]], normalized[cols[j]]
            
            # Lewati kolom dimensi (Kecamatan, dll)
            if is_dimension_column(cols[i]) or is_dimension_column(cols[j]):
                continue
            
            # Cek jika setelah dibersihkan namanya sama persis dan tidak kosong
            if ni == nj and ni != "":
                source, target = cols[j], cols[i]
                
                source_vals = df[source].values
                target_vals = df[target].values
                
                new_vals = []
                for s, t in zip(source_vals, target_vals):
                    str_s = str(s).strip() if s is not None else ""
                    str_t = str(t).strip() if t is not None else ""
                    if str_t and str_t.lower() not in ['', 'nan', 'none']:
                        new_vals.append(t)
                    elif str_s and str_s.lower() not in ['', 'nan', 'none']:
                        new_vals.append(s)
                    else:
                        new_vals.append(t)
                
                df[target] = new_vals
                cols_to_drop.add(source)
                logging.info(f"Menggabungkan kolom '{source}' -> '{target}'")
                
    if cols_to_drop:
        df.drop(columns=list(cols_to_drop), inplace=True)
        
    return df


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
