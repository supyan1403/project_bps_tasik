import re

headers = [
    "Laju Pertumbuhan Penduduk per Tahun 2020–2022 (%)",
    "Laju Pertumbuhan Penduduk per Tahun 2020–2022 (%) 2020–2022 (%)",
    "Laju Pertumbuhan Penduduk per Tahun 2020-2022 2020-2022",
    "Laju Pertumbuhan Penduduk per Tahun 2020-2022 (%) 2020-2022 (%)"
]

def clean_col_name(c):
    s = str(c).lower().strip()
    s = re.sub(r'\b(lanjutan|continued)\b', '', s)
    # Hapus pengulangan frase tahun + unit dengan toleransi spasi
    s = re.sub(r'(\b20\d{2}\b.*?)\s*\1', r'\1', s)
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

for h in headers:
    print(f"Original: {h} -> Clean: {clean_col_name(h)}")
