import json
import time
import psycopg2
from psycopg2.extras import Json

uri = 'postgresql://postgres.uxtmjfbndtjgzshuffcq:bpskabtasik@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

print("Menghubungkan ke Supabase...")
con = psycopg2.connect(uri)
cur = con.cursor()

print("Menghitung data overview...")
cur.execute("SELECT COUNT(*) FROM documents")
total_docs = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM extracted_tables")
total_tables = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM table_rows")
total_rows = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM table_rows WHERE is_anomaly = TRUE")
total_anomalies = cur.fetchone()[0]

# Hitung data points
LABEL_KEYS = {'Kecamatan', 'No / Uraian', 'Uraian', 'No', 'Desa', 'Kelurahan', 'Desa/Kelurahan'}
EMPTY_MARKERS = {'', '-', '--', '...', 'nan', 'none', 'null'}

cur.execute("SELECT data FROM table_rows WHERE data IS NOT NULL")
all_rows = cur.fetchall()
total_data_points = sum(
    len([v for k, v in (r[0] or {}).items()
         if k not in LABEL_KEYS and v is not None and str(v).strip().lower() not in EMPTY_MARKERS])
    for r in all_rows if r[0]
)

avg_rows_per_table = round(total_rows / max(total_tables, 1), 1)
avg_points_per_table = round(total_data_points / max(total_tables, 1), 1)

cur.execute("SELECT year FROM documents WHERE year IS NOT NULL")
doc_years = [r[0] for r in cur.fetchall()]
year_range = f"{min(doc_years)} - {max(doc_years)}" if doc_years else "2023 - 2026"

overview_payload = {
    "total_docs": total_docs,
    "total_tables": total_tables,
    "total_rows": total_rows,
    "total_data_points": total_data_points,
    "total_anomalies": total_anomalies,
    "avg_rows_per_table": avg_rows_per_table,
    "avg_points_per_table": avg_points_per_table,
    "total_babs": 13,
    "year_range": year_range
}

cur.execute("""
    INSERT INTO dashboard_cache (cache_key, payload, updated_at)
    VALUES (%s, %s, NOW())
    ON CONFLICT (cache_key) DO UPDATE
    SET payload = EXCLUDED.payload, updated_at = NOW();
""", ('stats_overview', Json(overview_payload)))
print("Overview cache berhasil disimpan!")

print("Menghitung data chart...")
# Import kalkulasi chart persis dari stats.py
import re
from collections import defaultdict

cur.execute("""
    SELECT d.year, COUNT(t.id)
    FROM documents d
    JOIN extracted_tables t ON d.id = t.document_id
    GROUP BY d.year
    ORDER BY d.year ASC
""")
chart_results = cur.fetchall()
years = [str(r[0]) for r in chart_results] if chart_results else ["2022", "2023", "2024", "2025", "2026"]
table_counts = [r[1] for r in chart_results] if chart_results else [15, 28, 42, 65, 80]

cat_counts = {
    "Sosial & Kesejahteraan": 0,
    "Ekonomi & PDRB": 0,
    "Pertanian & Lingkungan": 0,
    "Pemerintahan & Wilayah": 0
}

cur.execute("SELECT table_name FROM extracted_tables")
for (tname,) in cur.fetchall():
    m = re.search(r'Tabel\s+(\d+)\.', tname or '')
    b = int(m.group(1)) if m else None
    if b in [3, 4, 5, 6]:
        cat_counts["Sosial & Kesejahteraan"] += 1
    elif b in [1, 7, 8]:
        cat_counts["Pertanian & Lingkungan"] += 1
    elif b in [9, 10, 11, 12, 13]:
        cat_counts["Ekonomi & PDRB"] += 1
    elif b in [2]:
        cat_counts["Pemerintahan & Wilayah"] += 1
    else:
        tn = (tname or "").lower()
        if any(w in tn for w in ["penduduk", "sosial", "didik", "sehat", "miskin", "agama"]):
            cat_counts["Sosial & Kesejahteraan"] += 1
        elif any(w in tn for w in ["tani", "kebun", "hutan", "ikan", "iklim", "letak"]):
            cat_counts["Pertanian & Lingkungan"] += 1
        elif any(w in tn for w in ["pdrb", "ekonomi", "harga", "dagang", "industri", "hotel", "wisata"]):
            cat_counts["Ekonomi & PDRB"] += 1
        else:
            cat_counts["Pemerintahan & Wilayah"] += 1

ref_rows = defaultdict(int)
ref_points = defaultdict(int)
doc_points_dict = defaultdict(int)

cur.execute("""
    SELECT t.id, t.years, d.year
    FROM extracted_tables t
    JOIN documents d ON t.document_id = d.id
""")
tabs = cur.fetchall()

table_rows_map = defaultdict(list)
cur.execute("SELECT table_id, data FROM table_rows")
for tr_tid, tr_data in cur.fetchall():
    table_rows_map[tr_tid].append(tr_data)

for tid, ty, dy in tabs:
    rows_data = table_rows_map.get(tid, [])
    if not rows_data:
        continue
    r_count = len(rows_data)
    t_points = sum(len([v for k, v in (r or {}).items() if k not in LABEL_KEYS and v is not None and str(v).strip().lower() not in EMPTY_MARKERS]) for r in rows_data if r)
    if dy:
        doc_points_dict[str(dy)] += t_points
    
    found_years = []
    if ty:
        for y in ty:
            if y:
                m_ajaran = re.search(r'\b(20\d{2})/20\d{2}\b', str(y))
                if m_ajaran:
                    yr_val = int(m_ajaran.group(1))
                else:
                    m = re.search(r'\b(20\d{2}|19\d{2})\b', str(y))
                    yr_val = int(m.group(1)) if m else None
                if yr_val:
                    capped = min(yr_val, 2025)
                    if 2010 <= capped <= 2025 and capped not in found_years:
                        found_years.append(capped)
    if not found_years:
        found_years = [min((dy - 1) if dy else 2025, 2025)]
        
    n = len(found_years)
    b_rows = r_count // n
    rem_rows = r_count % n
    b_pts = t_points // n
    rem_pts = t_points % n
    
    for i, y_val in enumerate(found_years):
        ref_rows[y_val] += b_rows + (1 if i < rem_rows else 0)
        ref_points[y_val] += b_pts + (1 if i < rem_pts else 0)

valid_years = sorted([y for y in ref_rows.keys() if 2010 <= y <= 2025])
ref_labels = [str(y) for y in valid_years]
ref_rows_data = [ref_rows[y] for y in valid_years]
ref_pts_data = [ref_points[y] for y in valid_years]

doc_years_sorted = sorted(doc_points_dict.keys())
doc_pts_data = [doc_points_dict[y] for y in doc_years_sorted]

chart_payload = {
    "years": years,
    "table_counts": table_counts,
    "categories": list(cat_counts.keys()),
    "category_counts": list(cat_counts.values()),
    "doc_points_chart": {
        "labels": doc_years_sorted,
        "points": doc_pts_data
    },
    "ref_year_chart": {
        "labels": ref_labels,
        "rows": ref_rows_data,
        "points": ref_pts_data
    }
}

cur.execute("""
    INSERT INTO dashboard_cache (cache_key, payload, updated_at)
    VALUES (%s, %s, NOW())
    ON CONFLICT (cache_key) DO UPDATE
    SET payload = EXCLUDED.payload, updated_at = NOW();
""", ('stats_chart', Json(chart_payload)))
con.commit()
print("Chart cache berhasil disimpan ke Supabase!")
con.close()
