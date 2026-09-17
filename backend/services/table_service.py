import csv
import os
import re
from typing import Any


def get_safe_windows_path(path: str) -> str:
    """Mengonversi path ke format UNC yang aman untuk Windows."""
    if not path:
        return path
    if os.name == 'nt':
        abs_path = os.path.abspath(path)
        if not abs_path.startswith("\\\\?\\"):
            return "\\\\?\\" + abs_path.replace("/", "\\")
    return path

def sanitize_row_data(data: dict) -> dict:
    """Sanitasi nilai sel data: buang gambar base64, file data URL, dan tag HTML."""
    if not isinstance(data, dict):
        return {}
    cleaned = {}
    for k, v in data.items():
        if v is None:
            cleaned[k] = ""
            continue
        v_str = str(v)
        # Cegah string data URL base64 gambar
        if "data:image/" in v_str:
            cleaned[k] = ""
            continue
        # Bersihkan tag HTML
        v_clean = re.sub(r'<[^>]*?>', '', v_str).strip()
        cleaned[k] = v_clean
    return cleaned

def parse_csv_for_db(safe_path: str) -> tuple[list[str], list[dict[str, Any]], list[str], list[str]]:
    """Membaca file CSV dan mengembalikan headers, records, units, dan years."""
    raw_rows = []
    with open(safe_path, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f)
        raw_rows = list(reader)
            
    if not raw_rows:
        return [], [], [], []
        
    headers = raw_rows[0]
    seen = {}
    for i, h in enumerate(headers):
        key = str(h)
        cnt = seen.get(key, 0) + 1
        seen[key] = cnt
        if cnt > 1:
            headers[i] = f"{h}.{cnt - 1}"
    units = [""] * len(headers)
    years = [""] * len(headers)
    has_metadata = False
    if len(raw_rows) >= 3:
        col0_row1 = str(raw_rows[1][0]).strip().lower() if len(raw_rows[1]) > 0 else ""
        col0_row2 = str(raw_rows[2][0]).strip().lower() if len(raw_rows[2]) > 0 else ""
        if col0_row1 == "satuan" or col0_row2 == "tahun":
            has_metadata = True
            units = raw_rows[1]
            years = raw_rows[2]
        else:
            row1 = raw_rows[1]
            row2 = raw_rows[2]
            row1_col0_empty = str(row1[0]).strip() == "" if row1 else True
            row1_has_content = any(str(v).strip() for v in row1[1:]) if len(row1) > 1 else False
            row2_col0_empty = str(row2[0]).strip() == "" if row2 else True
            row2_values = [str(v).strip() for v in row2[1:] if str(v).strip()] if len(row2) > 1 else []
            def _is_year_like(s):
                if not s:
                    return False
                if s.isdigit() and 1900 <= int(s) <= 2100:
                    return True
                if '/' in s:
                    parts = s.split('/')
                    return all(p.isdigit() and 1900 <= int(p) <= 2100 for p in parts if p)
                return False
            row2_all_years = (
                len(row2_values) > 0 and
                all(_is_year_like(v) for v in row2_values)
            )
            if row1_col0_empty and row1_has_content and row2_col0_empty and row2_all_years:
                has_metadata = True
                units = raw_rows[1]
                years = raw_rows[2]

    if has_metadata:
        data_rows = raw_rows[3:]
    else:
        data_rows = raw_rows[1:]
        
    _PD_RE = re.compile(r'^\d+\.\d{1,2}$')

    def _fix_dot_decimal(val: str) -> str:
        s = str(val).strip()
        if _PD_RE.match(s):
            return s.replace('.', ',', 1)
        return val

    records = []
    for r in data_rows:
        record = {}
        for idx, h in enumerate(headers):
            val = r[idx] if idx < len(r) else ""
            if idx > 0 and val:
                val = _fix_dot_decimal(val)
            record[h] = val
        records.append(record)
        
    return headers, records, units, years

def natural_sort_key(t):
    """Menghasilkan kunci pengurutan natural untuk tabel berdasarkan nomor urut."""
    name = t.table_name or ""
    match = re.search(r'(\d+(?:\.\d+)+)', name)
    if match:
        try:
            parts = [int(p) for p in match.group(1).split('.')]
            return (0, parts, name.lower())
        except ValueError:
            pass
    return (1, [], name.lower())
