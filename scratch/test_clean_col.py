import re

c1 = "Laju Pertumbuhan Penduduk per Tahun 2020–2022"
c2 = "Laju Pertumbuhan Penduduk per Tahun 2020–2022 2020–2022"

def clean_col_name(c):
    s = str(c).lower().strip()
    s = re.sub(r'\b(lanjutan|continued)\b', '', s)
    words = s.split()
    print("Words:", words)
    unique_words = []
    for w in words:
        if not unique_words or w != unique_words[-1]:
            unique_words.append(w)
    s = " ".join(unique_words)
    print("Deduped:", s)
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

print("C1 clean:", clean_col_name(c1))
print("C2 clean:", clean_col_name(c2))
