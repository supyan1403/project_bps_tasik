import re

import models
from routers.tables import clean_bilingual_header, get_table_headers
from sqlalchemy.orm import Session

from pipeline import parse_indonesian_number


def extract_timeseries_year(year_val, default_year=None):
    """Mengekstrak tahun dari nilai kolom deret waktu."""
    if year_val is None or year_val == '':
        return default_year
    s = str(year_val).strip()
    m = re.search(r'\b(19\d{2}|20\d{2})\b', s)
    if m:
        return int(m.group(1))
    return default_year

def _clean_header_for_master(header: str) -> str:
    """Membersihkan nama kolom dari suffix nomor urut."""
    if not header:
        return ""
    h = clean_bilingual_header(header)
    h = re.sub(r'\.\d+$', '', h)
    return h.strip()

def get_column_years_from_db(db: Session, table, doc_year: int) -> dict:
    """Mengambil pemetaan kolom ke tahun dari basis data."""
    headers = get_table_headers(db, table)
    if not headers:
        return {}
    years = table.years or []
    col_years = {}

    first_lower = headers[0].lower() if headers else ""
    is_vertical = "tahun" in first_lower or "year" in first_lower

    if is_vertical:
        rows = db.query(models.TableRow).filter(models.TableRow.table_id == table.id).all()
        years_in_col0 = set()
        for r in rows:
            val = str(r.data.get(headers[0], "")).strip()
            y_extracted = extract_timeseries_year(val)
            if y_extracted:
                years_in_col0.add(y_extracted)
        for idx, h in enumerate(headers):
            if idx == 0:
                continue
            if not any(char.isalpha() for char in h):
                continue
            col_years.setdefault(_clean_header_for_master(h), set()).update(years_in_col0)
        col_years = {k: sorted(v) for k, v in col_years.items()}
    else:
        for idx, h in enumerate(headers):
            if idx == 0:
                continue
            if not any(char.isalpha() for char in h):
                continue
            yr_val = years[idx] if idx < len(years) else ""
            col_year = extract_timeseries_year(yr_val, default_year=doc_year - 1)
            col_years.setdefault(_clean_header_for_master(h), set()).add(col_year)
        col_years = {k: sorted(v) for k, v in col_years.items()}

    return col_years

def get_column_years_with_position(db: Session, table, doc_year: int) -> dict:
    """Mengambil pemetaan kolom ke tahun beserta posisi indeks kolom."""
    headers = get_table_headers(db, table)
    if not headers:
        return {}
    years = table.years or []
    result = {}
    first_lower = headers[0].lower() if headers else ""
    is_vertical = "tahun" in first_lower or "year" in first_lower

    if is_vertical:
        rows = db.query(models.TableRow).filter(models.TableRow.table_id == table.id).all()
        years_in_col0 = set()
        for r in rows:
            val = str(r.data.get(headers[0], "")).strip()
            y_extracted = extract_timeseries_year(val)
            if y_extracted:
                years_in_col0.add(y_extracted)
        for idx, h in enumerate(headers):
            if idx == 0:
                continue
            if not any(char.isalpha() for char in h):
                continue
            name = _clean_header_for_master(h)
            result.setdefault(name, {"years": set(), "pos": idx})
            result[name]["years"].update(years_in_col0)
    else:
        for idx, h in enumerate(headers):
            if idx == 0:
                continue
            if not any(char.isalpha() for char in h):
                continue
            name = _clean_header_for_master(h)
            yr_val = years[idx] if idx < len(years) else ""
            col_year = extract_timeseries_year(yr_val, default_year=doc_year - 1)
            result.setdefault(name, {"years": set(), "pos": idx})
            result[name]["years"].add(col_year)

    return result

def get_clean_chapter_name(level1: str) -> str:
    """Mengembalikan nama bab yang bersih berdasarkan nomor bab."""
    CHAPTER_NAMES = {
        "1": "Geografi dan Iklim",
        "2": "Pemerintahan",
        "3": "Penduduk dan Ketenagakerjaan",
        "4": "Sosial dan Kesejahteraan Rakyat",
        "5": "Pertanian, Kehutanan, dan Perikanan",
        "6": "Industri, Pertambangan, Energi, dan Air",
        "7": "Pariwisata",
        "8": "Transportasi dan Komunikasi",
        "9": "Koperasi dan Usaha Mikro Kecil Menengah (UMKM)",
        "10": "Pengeluaran dan Konsumsi Penduduk",
        "11": "Perdagangan",
        "12": "Pendapatan Regional",
        "13": "Perbandingan Regional / Antar Wilayah"
    }
    return CHAPTER_NAMES.get(str(level1).strip(), f"Bab {level1}")

def get_clean_table_name(table_name: str) -> str:
    """Membersihkan nama tabel dari prefix Tabel, tahun, dan halaman."""
    if not table_name:
        return ""
    name = re.sub(r'^(?:Tabel[\s_]*\d+(?:\.\d+)*\s*(?:-\s*|:\s*|)\s*)', '', table_name, flags=re.IGNORECASE)
    name = re.sub(r'\.csv$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\((?:Hal|Halaman|hlm)[\s\d,\-–—\.\?]+\)', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\(\s*\d+[\s,\d\-–—\.]*\)\s*$', '', name)
    year_token = r'(?:19|20)\d{2}[*\d]?'
    year_conn = r'(?:\s*(?:[-–—/]|dan|and|sd|s/d|to|,)\s*' + year_token + r')*'
    name = re.sub(r'[,.\s]+(?:(?:pada|di)\s+)?(?:tahun|years?)\s*(?:' + year_token + year_conn + r'.*)?$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[,.\s]+' + year_token + year_conn + r'.*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[,.\s]+(?:(?:pada|di)\s+)?(?:tahun|years?)\s*$', '', name, flags=re.IGNORECASE)
    return re.sub(r'[,.\-\s–—]+$', '', name).strip()

_KECAMATAN_TASIK = [
    "cipatujah", "karangnunggal", "cikalong", "pancatengah", "cikatomas",
    "cibalong", "parungponteng", "bantarkalong", "bojongasih", "culamega",
    "bojonggambir", "sodonghilir", "taraju", "salawu", "puspahiang",
    "tanjungjaya", "sukaraja", "salopa", "jatiwaras", "cineam",
    "karangjaya", "manonjaya", "gunungtanjung", "singaparna", "mangunreja",
    "sukarame", "cigalontang", "leuwisari", "padakembang", "sariwangi",
    "sukaratu", "cisayong", "sukahening", "rajapolah", "jamanis",
    "ciawi", "kadipaten", "pagerageung", "sukaresik", "kabupaten tasikmalaya"
]
_KECAMATAN_SET = set(_KECAMATAN_TASIK)

def normalize_entity_name(raw: str) -> str:
    """Menormalisasi nama entitas seperti kecamatan, pendidikan, dsb."""
    if not raw:
        return raw
    s_raw = str(raw).strip()
    _EDU_CODE_MAP = {
        "0": "≤ Sekolah Dasar (SD)",
        "1": "SMP / Sederajat",
        "2": "SMA / SMK / Sederajat",
        "3": "Perguruan Tinggi",
    }
    if s_raw in _EDU_CODE_MAP:
        return _EDU_CODE_MAP[s_raw]

    s_lower = s_raw.lower()
    if any(k in s_lower for k in ["sekolah dasar", "≤ sd", "<= sd", "sd / sederajat", "≤ sekolah dasar"]):
        return "≤ Sekolah Dasar (SD)"
    if "smp" in s_lower:
        return "SMP / Sederajat"
    if "sma" in s_lower or "smk" in s_lower:
        return "SMA / SMK / Sederajat"
    if "perguruan tinggi" in s_lower or "universitas" in s_lower or "diploma" in s_lower:
        return "Perguruan Tinggi"

    s = s_raw
    s = re.sub(r'^\d+[\s\.]+', '', s)
    s = re.sub(r'\s*\([^)]*\)', '', s)
    s = s.strip()
    s_lower = s.lower()
    for kec in _KECAMATAN_TASIK:
        if s_lower == kec:
            return kec.title()
    return s.title() if s.islower() else s

_ROMAN_VALUES = {
    'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10,
    'xi': 11, 'xii': 12, 'xiii': 13, 'xiv': 14, 'xv': 15, 'xvi': 16, 'xvii': 17, 'xviii': 18, 'xix': 19, 'xx': 20
}

def _get_timeseries_entity_sort_key(name: str):
    if not name:
        return (9999, 0, "")
    s = str(name).strip()
    s_lower = s.lower()
    
    # 1. Summary rows always at the bottom
    if s_lower in ["kabupaten tasikmalaya", "jumlah", "total"]:
        return (9999, 0, s_lower)
        
    # 2. Education levels
    edu_map = {
        "≤ sekolah dasar (sd)": 10,
        "smp / sederajat": 20,
        "sma / smk / sederajat": 30,
        "perguruan tinggi": 40
    }
    for k, r in edu_map.items():
        if k in s_lower:
            return (1, r, s_lower)
            
    # 3. Pure Roman Numerals (PPPK)
    m_roman = re.match(r'^(?:golongan\s+)?([ivx]+)$', s_lower)
    if m_roman and m_roman.group(1) in _ROMAN_VALUES:
        return (2, _ROMAN_VALUES[m_roman.group(1)], s_lower)
        
    # 4. PNS Rank Hierarchy
    m_pns = re.match(r'^(?:golongan\s+([ivx]+)(?:/.*)?|([ivx]+)\s*/\s*([a-e])(?:\s*\(.*\))?)$', s_lower)
    if m_pns:
        if m_pns.group(1) and m_pns.group(1) in _ROMAN_VALUES:
            g = _ROMAN_VALUES[m_pns.group(1)]
            return (3, g * 100 + 90, s_lower)
        elif m_pns.group(2) and m_pns.group(3) and m_pns.group(2) in _ROMAN_VALUES:
            g = _ROMAN_VALUES[m_pns.group(2)]
            sub = ord(m_pns.group(3)) - ord('a') + 1
            return (3, g * 100 + sub, s_lower)
            
    # 5. Numbered items
    m_num = re.match(r'^(\d+)', s)
    if m_num:
        return (4, int(m_num.group(1)), s_lower)
        
    return (5, 0, s_lower)

def normalize_entity_key(raw_key: str) -> str:
    """Menormalisasi kunci entitas menjadi kategori standar."""
    if not raw_key:
        return "Rincian"
    k = raw_key.lower().strip()
    if any(w in k for w in ["kecamatan", "distrik"]):
        return "Kecamatan"
    if any(w in k for w in ["desa", "kelurahan"]):
        return "Desa/Kelurahan"
    if any(w in k for w in ["kabupaten", "kota"]):
        return "Kabupaten/Kota"
    if "provinsi" in k:
        return "Provinsi"
    if any(w in k for w in ["tahun", "year"]):
        return "Tahun"
    if any(w in k for w in ["bulan", "month"]):
        return "Bulan"
    return "Rincian"

def _extract_year_range_from_table_name(table_name: str):
    if not table_name:
        return None
    m = re.search(r'\b(19\d{2}|20\d{2})\s*[\-–—~s\.\/]+s*d?\.?\s*(19\d{2}|20\d{2})\b', table_name)
    if m:
        y1, y2 = int(m.group(1)), int(m.group(2))
        return (min(y1, y2), max(y1, y2))
    return None

def _get_unit_multiplier(unit: str = "", table_name: str = "", header: str = "") -> float:
    combined = f"{unit} {table_name} {header}".lower()
    if any(k in combined for k in ["per kapita", "/kapita", "per orang", "per bulan", "persen", "%", "rasio", "indeks", "kepadatan", "laju", "umur harapan"]):
        return 1.0
    if re.search(r'\b(miliar|milyar)\b', combined):
        return 1000000000.0
    elif re.search(r'\bjuta\b', combined):
        return 1000000.0
    elif re.search(r'\b(ribu|thousands)\b', combined):
        return 1000.0
    return 1.0

def _format_scaled_indo_number(val_float) -> str:
    if val_float is None:
        return ""
    if val_float == int(val_float):
        n = int(val_float)
        return f'{n:,}'.replace(',', '.')
    else:
        fixed = f"{val_float:.2f}"
        int_part, dec_part = fixed.split('.')
        int_str = f'{int(int_part):,}'.replace(',', '.')
        dec_clean = dec_part.rstrip('0')
        return f"{int_str},{dec_clean}" if dec_clean else int_str

def _normalize_base_unit(unit_str: str) -> str:
    if not unit_str:
        return unit_str
    u = unit_str.strip()
    u_lower = u.lower()
    if u_lower in ['ribu', 'ribu jiwa', '(ribu)', '(ribu jiwa)']:
        return 'jiwa'
    if u_lower in ['ribu orang', '(ribu orang)']:
        return 'orang'
    if u_lower in ['ribu rupiah', 'juta rupiah', 'miliar rupiah']:
        return 'rupiah'
    if u_lower in ['ribu ton']:
        return 'ton'
    if u_lower in ['ribu ha']:
        return 'ha'
    if u_lower.startswith('ribu '):
        return u[5:].strip()
    return u

def _normalize_indo_number(val: str, unit: str = "", table_name: str = "", header: str = "") -> str:
    if not val:
        return val
    s = str(val).strip()
    if not s or s in ['-', '...', '']:
        return s
    
    num = parse_indonesian_number(s)
    if num is None:
        return s
    
    mult = _get_unit_multiplier(unit, table_name, header)
    if mult == 1000.0:
        if num >= 60000.0 or " " in s and len(s.replace(" ", "")) >= 6 or re.match(r'^[1-9]\d{0,2}\.\d{3}$', s):
            mult = 1.0
        elif s.count('.') > 1:
            parts = s.split('.')
            if len(parts[-1]) == 3:
                mult = 1.0
    elif mult == 1000000.0 and num >= 1000000.0:
        mult = 1.0
        
    scaled = num * mult
    return _format_scaled_indo_number(scaled)

def _extract_unit_from_table_name(table_name: str) -> str:
    if not table_name:
        return ""
    matches = re.findall(r'\(([^)]+)\)', table_name)
    _NON_UNIT_ABBREVS = {'apk', 'apm', 'asn', 'iumk', 'tpak', 'tpt', 'ra', 'mi', 'ma', 'mts', 'sd', 'smp', 'sma', 'smk', 'tk', 'persero'}
    for m in matches:
        m_stripped = m.strip()
        m_lower = m_stripped.lower()
        if m_lower.startswith('hal') or re.match(r'^\d{4}', m_lower) or m_lower in _NON_UNIT_ABBREVS or len(m_stripped) > 30:
            continue
        return m_stripped
    return ""

def _infer_unit_from_indicator(indicator_name: str) -> str:
    if not indicator_name:
        return ""
    name_lower = indicator_name.lower().strip()
    DIMENSION_PATTERNS = [
        r'^(kecamatan|kabupaten|kota|provinsi|negara|ibukota|ibukota\s+kecamatan)$',
        r'^(jenis\s+tanaman|jenis\s+ikan|jenis\s+industri|jenis\s+koperasi|jenis\s+pengeluaran|jenis\s+pendapatan|jenis\s+permukaan|jenis\s+penangkapan|jenis\s+pengelolaan|jenis\s+sarana|jenis\s+pelanggan)$',
        r'^(lapangan\s+usaha|subsektor|sektor)$',
        r'^(kelompok\s+umur|kelompok\s+komoditas|golongan|golongan\s+tarip|golongan\s+tarif|pangkat|jenjang|tingkat\s+pendidikan|jabatan|kegiatan\s+utama|status\s+pekerjaan)$',
        r'^(partai\s+politik|partai)$',
        r'^(uraian|rincian|kategori|keterangan|kondisi\s+jalan|objek\s+wisata)$',
        r'^(triw|bulan|tahun)$',
        r'^(menurut\s+kabupaten|menurut\s+kecamatan)$',
        r'^(tingkat\s+kewenangan)$'
    ]
    for pat in DIMENSION_PATTERNS:
        if re.search(pat, name_lower):
            return ""
    _UNIT_KEYWORD_MAP = [
        (r'kepadatan\s+penduduk', 'jiwa/km²'),
        (r'rasio\s+jenis\s+kelamin', 'rasio'),
        (r'indeks\s+pembangunan\s+manusia', 'indeks'),
        (r'angka\s+partisipasi', '%'),
        (r'tingkat\s+pengangguran', '%'),
        (r'laju\s+pertumbuhan', '%'),
        (r'persentase', '%'),
        (r'populasi\s+(ternak|unggas)', 'ekor'),
        (r'produksi\s+(daging|susu|telur|ikan|budidaya|perikanan|padi|kedelai|jagung|ubi|tebu|tembakau)', 'ton'),
        (r'produksi\s+(mangga|durian|jeruk|pisang|pepaya|salak|manggis|alpukat|bawang|cabai|kentang|kubis|tomat|sayuran|buah)', 'kuintal'),
        (r'luas\s+(panen|areal|lahan|sawah|hutan|tanaman)', 'ha'),
        (r'luas\s+(wilayah|daerah)', 'km²'),
        (r'jumlah\s+(guru|murid|dosen|siswa|dokter|perawat|bidan|tenaga\s+kesehatan|anggota|karyawan)', 'orang'),
        (r'jumlah\s+penduduk', 'jiwa'),
        (r'jumlah\s+(puskesmas|posyandu|masjid|mushola|gereja|pura|vihara|hotel|koperasi|pasar|industri|kantor|sekolah)', 'unit'),
        (r'pengeluaran\s+per\s+kapita', 'rupiah'),
        (r'upah\s+minimum', 'rupiah'),
        (r'produk\s+domestik\s+regional\s+bruto', 'juta rupiah'),
        (r'panjang\s+(jalan|saluran|irigasi)', 'km'),
        (r'curah\s+hujan', 'mm'),
        (r'suhu\s+rata-rata', '°C'),
    ]
    for pattern, unit in _UNIT_KEYWORD_MAP:
        if re.search(pattern, name_lower):
            return unit
    return ""

def _infer_unit_from_headers_and_table(headers: list, table_name: str) -> str:
    unit = _extract_unit_from_table_name(table_name)
    if unit:
        return _normalize_base_unit(unit)
    for h in headers:
        u = _infer_unit_from_indicator(h)
        if u:
            return _normalize_base_unit(u)
    return ""

def _build_vk_units(headers: list, table_name: str) -> dict:
    table_unit = _extract_unit_from_table_name(table_name)
    result = {}
    for h in headers:
        u = _infer_unit_from_indicator(h) or table_unit or ""
        result[h] = _normalize_base_unit(u)
    return result

def _classify_entity_type(entity_name: str) -> str:
    if not entity_name:
        return "Lainnya"
    name_lower = entity_name.lower().strip()
    if name_lower.startswith(("kab.", "kabupaten", "kota")):
        return "Kabupaten/Kota"
    if "provinsi" in name_lower or name_lower in ["jawa barat", "jawa tengah", "jawa timur", "banten", "dki jakarta"]:
        return "Provinsi"
    if name_lower in _KECAMATAN_SET:
        return "Kecamatan"
    if name_lower in ["indonesia", "asia", "eropa", "amerika", "dunia", "world"]:
        return "Nasional/Internasional"
    if name_lower in ["jumlah", "total", "subtotal", "grand total", "keseluruhan", "seluruh"]:
        return "Total"
    return "Lainnya"

def check_cell_format_anomaly(raw_val: str, prev_raw_val: str | None = None) -> str | None:
    """Memeriksa format anomali pada nilai sel berdasarkan nilai sebelumnya."""
    s = str(raw_val).strip()
    if not s or s in ["-", "...", "–", "—", ""]:
        return None
    if "?" in s or ".." in s or ",," in s:
        return f"Karakter/simbol rusak pada angka ({s})"
    if re.search(r'^\d{1,3}\s+\d{3}', s):
        return f"Spasi pemisah ribuan janggal ({s})"
    
    p = str(prev_raw_val).strip() if prev_raw_val else ""
    p_valid = bool(p) and p not in ["-", "...", "–", "—", ""]
    _C3 = r'^[1-9]\d{0,2},\d{3}$'
    _P3 = r'^\d{1,3}\.\d{3}$'
    _PD = r'^\d+\.\d{1,2}$'
    _CD = r'^\d+,\d{1,2}$'
    
    if p_valid:
        if re.match(_P3, p) and re.match(_C3, s):
            return f"Inkonsistensi format: tahun sebelumnya titik ribuan ({p}), tahun ini koma ({s})"
        if re.match(_C3, p) and re.match(_P3, s):
            return f"Inkonsistensi format: tahun sebelumnya koma ({p}), tahun ini titik ribuan ({s})"
        if re.match(_CD, p) and re.match(_PD, s):
            return f"Inkonsistensi format: tahun sebelumnya koma desimal ({p}), tahun ini titik ({s})"
        if re.match(_PD, p) and re.match(_CD, s):
            return f"Inkonsistensi format: tahun sebelumnya titik desimal ({p}), tahun ini koma ({s})"
        if (re.match(_PD, p) and re.match(_PD, s)) or (re.match(_CD, p) and re.match(_CD, s)) or (re.match(_P3, p) and re.match(_P3, s)) or (re.match(_C3, p) and re.match(_C3, s)):
            return None
    if re.match(_PD, s):
        return f"Format salah: menggunakan titik desimal ({s}) alih-alih koma desimal"
    return None

def detect_timeseries_anomalies(tables_data: list) -> list:
    """Mendeteksi anomali deret waktu pada data tabel multi-tahun."""
    if not tables_data:
        return []
    entity_series = {}
    for t in tables_data:
        yr = t.get("year")
        if not yr or not isinstance(yr, int):
            continue
        for row in t.get("data", []):
            ent = row.get("entitas", "").strip()
            if not ent:
                continue
            if ent not in entity_series:
                entity_series[ent] = {}
            for vk, val_str in row.get("nilai", {}).items():
                if vk not in entity_series[ent]:
                    entity_series[ent][vk] = {}
                entity_series[ent][vk][yr] = str(val_str).strip()

    anomalies = []
    for ent, vk_dict in entity_series.items():
        for vk, yr_dict in vk_dict.items():
            sorted_years = sorted(yr_dict.keys())
            if len(sorted_years) < 2:
                continue
            for i in range(1, len(sorted_years)):
                prev_yr = sorted_years[i - 1]
                curr_yr = sorted_years[i]
                if curr_yr - prev_yr > 3:
                    continue
                prev_raw = yr_dict[prev_yr]
                curr_raw = yr_dict[curr_yr]
                err = check_cell_format_anomaly(curr_raw, prev_raw)
                if err:
                    anomalies.append({
                        "entitas": ent,
                        "indicator": vk,
                        "year": curr_yr,
                        "prev_year": prev_yr,
                        "val": curr_raw,
                        "prev_val": prev_raw,
                        "type": "format",
                        "severity": "high",
                        "message": f"Nilai '{ent}' ({vk}): {err}."
                    })
                pnum = parse_indonesian_number(prev_raw)
                cnum = parse_indonesian_number(curr_raw)
                if pnum and cnum and pnum != 0 and cnum != 0:
                    ratio = cnum / pnum
                    if abs(ratio) > 100 or abs(ratio) < 0.01:
                        scale_desc = f"naik {ratio:.0f}x" if ratio > 1 else f"turun ke 1/{1/ratio:.0f}-nya"
                        anomalies.append({
                            "entitas": ent,
                            "indicator": vk,
                            "year": curr_yr,
                            "prev_year": prev_yr,
                            "val": curr_raw,
                            "prev_val": prev_raw,
                            "type": "scale",
                            "severity": "medium",
                            "message": f"Nilai '{ent}' ({vk}): {scale_desc} drastis antara {prev_yr} ({prev_raw}) dan {curr_yr} ({curr_raw})."
                        })
    return anomalies

def _dedup_timeseries_results(results):
    raw_groups = {}
    for r in results:
        key = (r["year"], r.get("entity_key", "").strip().lower())
        raw_groups.setdefault(key, []).append(r)

    groups = {}
    for key, group in raw_groups.items():
        subgroups = []
        for r in group:
            rset = set(r.get("headers", []))
            merged = False
            for i, (g_headers, gset, members) in enumerate(subgroups):
                if rset == gset or rset.issubset(gset) or gset.issubset(rset):
                    if len(rset) > len(gset):
                        subgroups[i] = (r["headers"], rset, members + [r])
                    else:
                        subgroups[i] = (g_headers, gset, members + [r])
                    merged = True
                    break
            if not merged:
                subgroups.append((r["headers"], rset, [r]))
        groups[key] = subgroups

    deduped = []
    for (year, entity_key), subgroups in groups.items():
        for headers_tuple, hset, group in subgroups:
            group.sort(key=lambda r: r.get("doc_year", 0), reverse=True)
            merged_data = {}
            merged_sources = {}
            best_table_info = group[0]

            for r in group:
                for k, sinfo in r.get("sources", {}).items():
                    if k not in merged_sources:
                        merged_sources[k] = sinfo
                for row in r["data"]:
                    ent = row["entitas"]
                    if ent not in merged_data:
                        merged_data[ent] = {**row, "nilai": dict(row.get("nilai", {})), "sumber": dict(row.get("sumber", {}))}
                    else:
                        for k, v in row.get("nilai", {}).items():
                            cur = merged_data[ent]["nilai"].get(k)
                            if v not in (None, "") and cur in (None, ""):
                                merged_data[ent]["nilai"][k] = v
                                if "sumber" in row and k in row["sumber"]:
                                    merged_data[ent].setdefault("sumber", {})[k] = row["sumber"][k]

            if merged_data:
                data_rows = list(merged_data.values())
                data_rows.sort(key=lambda r: _get_timeseries_entity_sort_key(r["entitas"]))
                deduped.append({
                    "table_id": best_table_info["table_id"],
                    "table_name": best_table_info["table_name"],
                    "year": year,
                    "doc_year": best_table_info.get("doc_year", 0),
                    "doc_filename": best_table_info.get("doc_filename", ""),
                    "entity_key": best_table_info["entity_key"],
                    "headers": list(headers_tuple),
                    "unit": best_table_info.get("unit", ""),
                    "vk_units": best_table_info.get("vk_units", {}),
                    "sources": merged_sources,
                    "data": data_rows
                })

    # Prioritaskan tabel berdimensi lengkap: jika sudah ada tabel rincian multi-baris (misal per pendidikan/kecamatan),
    # maka tabel agregat 1 baris dengan entity_key generik ('Rincian'/'Uraian') yang isinya cuma 'Kabupaten Tasikmalaya' dieliminasi
    has_rich_breakdown = any(len(t.get("data", [])) > 1 and t.get("entity_key", "").lower() not in ["rincian", "uraian"] for t in deduped)
    if has_rich_breakdown:
        deduped = [
            t for t in deduped
            if not (
                t.get("entity_key", "").lower() in ["rincian", "uraian"] and 
                len(t.get("data", [])) <= 1 and 
                all(r.get("entitas") in ["Kabupaten Tasikmalaya", "Total"] for r in t.get("data", []))
            )
        ]
    return deduped


# Export ALL symbols (including leading underscores) for 100% backwards compatibility
__all__ = [k for k, v in list(globals().items()) if not (k.startswith('__') and k.endswith('__'))]
