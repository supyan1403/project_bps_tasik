import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from collections import defaultdict

import models
from database import get_db

router = APIRouter(prefix="/api/stats", tags=["Dashboard Stats"])

@router.get("")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_docs = db.query(models.Document).count()
    total_tables = db.query(models.ExtractedTable).count()
    total_rows = db.query(models.TableRow).count()
    total_anomalies = db.query(models.TableRow).filter(models.TableRow.is_anomaly == True).count()
    
    LABEL_KEYS = {'Kecamatan', 'No / Uraian', 'Uraian', 'No', 'Desa', 'Kelurahan', 'Desa/Kelurahan'}
    EMPTY_MARKERS = {'', '-', '--', '...', 'nan', 'none', 'null'}
    total_data_points = 0
    try:
        rows = db.query(models.TableRow.data).all()
        total_data_points = sum(
            len([v for k, v in (r.data or {}).items()
                 if k not in LABEL_KEYS and v is not None and str(v).strip().lower() not in EMPTY_MARKERS])
            for r in rows if r.data
        )
    except Exception:
        total_data_points = 0

    avg_rows_per_table = round(total_rows / max(total_tables, 1), 1)
    avg_points_per_table = round(total_data_points / max(total_tables, 1), 1)
    
    doc_years = [d.year for d in db.query(models.Document.year).all() if d.year]
    year_range = f"{min(doc_years)} - {max(doc_years)}" if doc_years else "2023 - 2026"
    
    all_table_names = db.query(models.ExtractedTable.table_name).all()
    detected_babs = set()
    for (tname,) in all_table_names:
        m = re.search(r'Tabel\s+(\d+)\.', tname or '')
        if m:
            detected_babs.add(int(m.group(1)))
    total_babs = len(detected_babs) if detected_babs else 13

    return {
        "total_docs": total_docs,
        "total_tables": total_tables,
        "total_rows": total_rows,
        "total_data_points": total_data_points,
        "total_anomalies": total_anomalies,
        "avg_rows_per_table": avg_rows_per_table,
        "avg_points_per_table": avg_points_per_table,
        "total_babs": total_babs,
        "year_range": year_range
    }

@router.get("/chart")
def get_chart_stats(db: Session = Depends(get_db)):
    results = db.query(
        models.Document.year,
        func.count(models.ExtractedTable.id)
    ).join(
        models.ExtractedTable, 
        models.Document.id == models.ExtractedTable.document_id
    ).group_by(
        models.Document.year
    ).order_by(
        models.Document.year.asc()
    ).all()
    
    if results:
        years = [str(r[0]) for r in results]
        table_counts = [r[1] for r in results]
        seen = set()
        deduped = []
        for y, c in zip(years, table_counts):
            if y not in seen:
                seen.add(y)
                deduped.append((y, c))
        if len(deduped) < len(years):
            years = [y for y, _ in deduped]
            table_counts = [c for _, c in deduped]
    else:
        years = ["2022", "2023", "2024", "2025", "2026"]
        table_counts = [15, 28, 42, 65, 80]
    
    cat_counts = {
        "Sosial & Kesejahteraan": 0,
        "Ekonomi & PDRB": 0,
        "Pertanian & Lingkungan": 0,
        "Pemerintahan & Wilayah": 0
    }
    
    all_tables = db.query(models.ExtractedTable.table_name).all()
    for (tname,) in all_tables:
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
        
    row_counts_raw = (
        db.query(
            models.Document.year,
            func.count(models.TableRow.id)
        )
        .join(models.ExtractedTable, models.Document.id == models.ExtractedTable.document_id)
        .join(models.TableRow, models.ExtractedTable.id == models.TableRow.table_id)
        .group_by(models.Document.year)
        .all()
    )
    row_counts_dict = {str(yr): cnt for yr, cnt in row_counts_raw if yr is not None}
    has_real_rows = sum(row_counts_dict.values()) > 0
    
    ref_rows = defaultdict(int)
    ref_points = defaultdict(int)
    doc_points_dict = defaultdict(int)
    
    tabs = (
        db.query(models.ExtractedTable.id, models.ExtractedTable.years, models.Document.year)
        .join(models.Document, models.ExtractedTable.document_id == models.Document.id)
        .all()
    )
    
    for tid, ty, dy in tabs:
        rows = db.query(models.TableRow).filter(models.TableRow.table_id == tid).all()
        if not rows:
            continue
        r_count = len(rows)
        EMPTY_MARKERS_PTS = {'', '-', '--', '...', 'nan', 'none', 'null'}
        LABEL_KEYS_PTS = {'Kecamatan', 'No / Uraian', 'Uraian', 'No', 'Desa', 'Kelurahan', 'Desa/Kelurahan'}
        t_points = sum(len([v for k, v in (r.data or {}).items() if k not in LABEL_KEYS_PTS and v is not None and str(v).strip().lower() not in EMPTY_MARKERS_PTS]) for r in rows if r.data)
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
        
        for idx, yr in enumerate(found_years):
            ref_rows[str(yr)] += b_rows + (1 if idx < rem_rows else 0)
            ref_points[str(yr)] += b_pts + (1 if idx < rem_pts else 0)
            
    cum_rows = 0
    cum_pts = 0
    growth_data_rows = []
    growth_data_points = []
    for idx, yr in enumerate(years):
        if has_real_rows:
            cum_rows += row_counts_dict.get(yr, 0)
            cum_pts += doc_points_dict.get(yr, 0)
        else:
            cum_rows += table_counts[idx] * 35
            cum_pts += table_counts[idx] * 350
        growth_data_rows.append(cum_rows)
        growth_data_points.append(cum_pts)

    final_rows = {}
    final_pts = {}
    for yr in set(list(ref_rows.keys()) + list(ref_points.keys())):
        target_yr = '2018' if int(yr) < 2018 else yr
        final_rows[target_yr] = final_rows.get(target_yr, 0) + ref_rows.get(yr, 0)
        final_pts[target_yr] = final_pts.get(target_yr, 0) + ref_points.get(yr, 0)

    sorted_ref_years = sorted(final_rows.keys(), key=lambda x: int(x))
    ref_year_labels = sorted_ref_years
    ref_year_rows_data = [final_rows[yr] for yr in sorted_ref_years]
    ref_year_points_data = [final_pts[yr] for yr in sorted_ref_years]
        
    ref_year_chart = {
        "labels": ref_year_labels,
        "datasets": [
            {
                "label": "Banyak Titik Nilai Data",
                "data": ref_year_points_data,
                "backgroundColor": "rgba(99, 102, 241, 0.8)",
                "borderColor": "rgba(99, 102, 241, 1)",
                "borderWidth": 1.5,
                "borderRadius": 5,
                "order": 1
            },
            {
                "label": "Baris Record Data",
                "data": ref_year_rows_data,
                "backgroundColor": "rgba(16, 185, 129, 0.8)",
                "borderColor": "rgba(16, 185, 129, 1)",
                "borderWidth": 1.5,
                "borderRadius": 5,
                "order": 2
            }
        ]
    }

    return {
        "bar_chart": {
            "labels": years,
            "datasets": [
                {
                    "label": "Jumlah Tabel Terintegrasi",
                    "data": table_counts,
                    "backgroundColor": "rgba(37, 99, 235, 0.75)",
                    "borderColor": "rgba(37, 99, 235, 1)",
                    "borderWidth": 1.5,
                    "borderRadius": 6
                }
            ]
        },
        "donut_chart": {
            "labels": list(cat_counts.keys()),
            "datasets": [
                {
                    "data": list(cat_counts.values()),
                    "backgroundColor": [
                        "rgba(59, 130, 246, 0.85)",
                        "rgba(16, 185, 129, 0.85)",
                        "rgba(245, 158, 11, 0.85)",
                        "rgba(139, 92, 246, 0.85)"
                    ],
                    "borderColor": "#ffffff",
                    "borderWidth": 2,
                    "hoverOffset": 4
                }
            ]
        },
        "line_chart": {
            "labels": years,
            "datasets": [
                {
                    "label": "Banyak Titik Data (Akumulatif)",
                    "data": growth_data_points,
                    "fill": True,
                    "backgroundColor": "rgba(99, 102, 241, 0.15)",
                    "borderColor": "rgba(99, 102, 241, 1)",
                    "borderWidth": 2.5,
                    "tension": 0.35,
                    "pointBackgroundColor": "#6366f1",
                    "pointRadius": 4.5,
                    "order": 1
                },
                {
                    "label": "Baris Record Data (Akumulatif)",
                    "data": growth_data_rows,
                    "fill": True,
                    "backgroundColor": "rgba(56, 189, 248, 0.15)",
                    "borderColor": "rgba(2, 132, 199, 1)",
                    "borderWidth": 2.5,
                    "tension": 0.35,
                    "pointBackgroundColor": "#0284c7",
                    "pointRadius": 4.5,
                    "order": 2
                }
            ]
        },
        "ref_year_chart": ref_year_chart,
        "labels": years,
        "datasets": [
            {
                "label": "Jumlah Tabel Terintegrasi",
                "data": table_counts,
                "backgroundColor": "rgba(59, 130, 246, 0.65)",
                "borderColor": "rgba(59, 130, 246, 1)",
                "borderWidth": 2,
                "borderRadius": 6
            }
        ]
    }
