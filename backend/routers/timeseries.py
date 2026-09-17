import io
import os
import re
import sys
import threading
import time
from typing import Any

import openpyxl
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from pydantic import BaseModel
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import models
from database import get_db
from routers.tables import get_table_headers

router = APIRouter(prefix="/api", tags=["Time Series Analysis"])

# Re-export all timeseries helper algorithms and business logic from services layer
from services.timeseries_service import *


class TimeSeriesExportRequest(BaseModel):
    years: list[int]
    valueKeys: list[str]
    vkUnits: dict[str, str] | None = {}
    entities: list[str] | None = []
    entityMap: dict[str, Any]

@router.get("/timeseries/catalog")
def timeseries_catalog(db: Session = Depends(get_db)):
    """Mengambil katalog lengkap tabel deret waktu beserta info bab dan tahun."""
    rows = db.query(models.ExtractedTable.id, models.ExtractedTable.table_name, models.Document.year).join(
        models.Document, models.ExtractedTable.document_id == models.Document.id
    ).all()
    seen = set()
    items = []
    for row in rows:
        key = (row.table_name.strip() if row.table_name else '', row.year)
        if key in seen:
            continue
        seen.add(key)
        name = key[0]
        m = re.match(r'(?:tabel\s*)?(\d+(?:\.\d+)*)', name, re.IGNORECASE)
        parts = m.group(1).split('.') if m else []
        level1 = parts[0] if len(parts) >= 1 else ''
        level2 = parts[0] + '.' + parts[1] if len(parts) >= 2 else ''
        table_prefix = f"Tabel {m.group(1)}" if m else ""
        items.append({
            "table_id": row.id,
            "table_name": name,
            "clean_table_name": get_clean_table_name(name),
            "table_prefix": table_prefix,
            "level1": level1,
            "clean_chapter_name": get_clean_chapter_name(level1),
            "level2": level2,
            "year": row.year
        })
    return {"status": "success", "data": items}

@router.get("/timeseries/table-details")
def timeseries_table_details(table_prefix: str, db: Session = Depends(get_db)):
    """Mengambil detail indikator dan tahun yang tersedia untuk prefix tabel tertentu."""
    prefix_clean = table_prefix.strip()
    tables = db.query(models.ExtractedTable).filter(models.ExtractedTable.table_name.like(f"%{prefix_clean}%")).all()
    if not tables:
        return {"status": "success", "indicators": []}
    doc_ids = [t.document_id for t in tables]
    docs = db.query(models.Document).filter(models.Document.id.in_(doc_ids)).all()
    doc_year_map = {d.id: d.year for d in docs}
    all_indicators = {}
    for table in tables:
        doc_year = doc_year_map.get(table.document_id, 2026)
        col_years = get_column_years_from_db(db, table, doc_year)
        for col_name, yrs in col_years.items():
            all_indicators.setdefault(col_name, set()).update(yrs)
    result = [{"name": col_name, "years": sorted(yrs)} for col_name, yrs in all_indicators.items()]
    return {"status": "success", "indicators": result}

# In-memory TTL cache for indicator-years (15 minutes)
_INDICATOR_YEARS_CACHE = None
_INDICATOR_YEARS_CACHE_TIME = 0
_INDICATOR_YEARS_TTL = 900  # 15 minutes
_INDICATOR_CACHE_LOCK = threading.Lock()

def invalidate_indicator_cache():
    """Menghapus cache indikator-tahun agar data diperbarui pada permintaan berikutnya."""
    global _INDICATOR_YEARS_CACHE, _INDICATOR_YEARS_CACHE_TIME
    with _INDICATOR_CACHE_LOCK:
        _INDICATOR_YEARS_CACHE = None
        _INDICATOR_YEARS_CACHE_TIME = 0

@router.get("/timeseries/indicator-years")
def timeseries_indicator_years(response: Response, db: Session = Depends(get_db)):
    """Mengambil daftar semua indikator beserta tahun-tahun yang tersedia di seluruh tabel."""
    global _INDICATOR_YEARS_CACHE, _INDICATOR_YEARS_CACHE_TIME
    response.headers["Cache-Control"] = "public, s-maxage=300, stale-while-revalidate=600"

    now = time.time()
    with _INDICATOR_CACHE_LOCK:
        if _INDICATOR_YEARS_CACHE is not None and (now - _INDICATOR_YEARS_CACHE_TIME) < _INDICATOR_YEARS_TTL:
            return {"status": "success", "indicators": _INDICATOR_YEARS_CACHE}

    tables = db.query(models.ExtractedTable).all()
    if not tables:
        return {"status": "success", "indicators": []}
    doc_ids = [t.document_id for t in tables]
    docs = db.query(models.Document).filter(models.Document.id.in_(doc_ids)).all()
    doc_year_map = {d.id: d.year for d in docs}

    def _extract_bab(tname):
        if not tname: return None
        m = re.search(r'Tabel[\s_]*(\d+)', tname, re.IGNORECASE) or re.search(r'(\d+)', tname)
        return int(m.group(1)) if m else None

    tables_ordered = sorted(tables, key=lambda t: (_extract_bab(t.table_name) or 9999, doc_year_map.get(t.document_id, 9999), t.id))
    all_indicators = {}
    for table in tables_ordered:
        doc_year = doc_year_map.get(table.document_id, 2026)
        bab = _extract_bab(table.table_name)
        col_data = get_column_years_with_position(db, table, doc_year)
        for name, info in col_data.items():
            if name not in all_indicators:
                all_indicators[name] = {"years": set(), "order": [bab if bab is not None else 9999, info["pos"]]}
            all_indicators[name]["years"].update(info["years"])

    result = []
    for name, info in all_indicators.items():
        raw_bab = info["order"][0] if info["order"][0] != 9999 else None
        bab_name = get_clean_chapter_name(str(raw_bab)) if raw_bab is not None else None
        if bab_name and bab_name == f"Bab {raw_bab}":
            bab_name = None
        result.append({
            "name": name,
            "years": sorted(info["years"]),
            "bab_num": raw_bab,
            "bab_name": bab_name,
            "order": info["order"]
        })
    result.sort(key=lambda x: (x["order"][0], x["order"][1], x["name"]))

    with _INDICATOR_CACHE_LOCK:
        _INDICATOR_YEARS_CACHE = result
        _INDICATOR_YEARS_CACHE_TIME = time.time()

    return {"status": "success", "indicators": result}

@router.get("/timeseries/data-by-indicators")
def timeseries_data_by_indicators(indicators: str = "", years: str = "", db: Session = Depends(get_db)):
    """Fetch multi-year time series table data by selected indicator names and years."""
    if not indicators or not years:
        return {"status": "success", "data": []}

    ind_list = [i.strip() for i in indicators.split(",") if i.strip()]
    ind_set = {i.lower() for i in ind_list}
    
    year_list = []
    for y in years.split(","):
        y_str = y.strip()
        if y_str.isdigit():
            year_list.append(int(y_str))
    year_set = set(year_list)
    
    if not ind_set or not year_set:
        return {"status": "success", "data": []}

    tables = db.query(models.ExtractedTable).all()
    doc_ids = [t.document_id for t in tables]
    docs = db.query(models.Document).filter(models.Document.id.in_(doc_ids)).all()
    doc_map = {d.id: d for d in docs}

    # Urutkan tabel berdasarkan tahun publikasi (doc_year) menurun: publikasi 2026 dicek terlebih dahulu, lalu mundur ke 2025, 2024, dst.
    tables.sort(key=lambda t: (doc_map.get(t.document_id).year if doc_map.get(t.document_id) and doc_map.get(t.document_id).year else 0), reverse=True)

    matched_results = []
    for table in tables:
        doc = doc_map.get(table.document_id)
        doc_year = doc.year if doc else 2026
        col_years = get_column_years_from_db(db, table, doc_year)

        matched_cols = [c for c in col_years if c.strip().lower() in ind_set]
        if not matched_cols:
            continue

        all_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table.id).all()
        if not all_rows:
            continue

        headers = get_table_headers(db, table)
        entity_key = headers[0] if headers else "Kecamatan"
        
        # Filter hanya kolom indikator yang dicentang/diminta oleh user
        value_cols = [c for c in headers if c != entity_key and any(c.strip().lower() == mc.strip().lower() for mc in matched_cols)]
        if not value_cols:
            continue

        for col in matched_cols:
            for yr in col_years[col]:
                if yr in year_set:
                    data_rows = []
                    for r in all_rows:
                        record = r.data
                        ent = str(record.get(entity_key, "")).strip() if record.get(entity_key) is not None else ""
                        if not ent:
                            # Defensive fallback: gunakan key pertama jika entity_key tidak ditemukan persis
                            first_k = next(iter(record.keys())) if record else None
                            if first_k and first_k not in value_cols:
                                ent = str(record.get(first_k, "")).strip()
                        if not ent or ent in ["-", "..."]:
                            continue
                        ent = normalize_entity_name(ent)
                        
                        def _get_val_rec(rec, c_name):
                            v = rec.get(c_name)
                            if (v is None or str(v).strip() == "") and f"{c_name}.1" in rec:
                                v = rec.get(f"{c_name}.1")
                            return str(v).strip() if v is not None else ""

                        vals = {c: _normalize_indo_number(_get_val_rec(record, c), unit="", table_name=table.table_name, header=c) for c in value_cols}
                        data_rows.append({"entitas": ent, "tipe": _classify_entity_type(ent), "nilai": vals})

                    matched_results.append({
                        "table_id": table.id,
                        "table_name": table.table_name,
                        "year": yr,
                        "doc_year": doc_year,
                        "doc_filename": doc.filename if doc else "",
                        "entity_key": entity_key,
                        "headers": value_cols,
                        "unit": _infer_unit_from_headers_and_table(value_cols, table.table_name),
                        "vk_units": _build_vk_units(value_cols, table.table_name),
                        "sources": {
                            c: {
                                "table_id": table.id,
                                "table_name": table.table_name,
                                "doc_year": doc_year,
                                "doc_filename": doc.filename if doc else "",
                                "raw_col": c
                            } for c in value_cols
                        },
                        "data": data_rows
                    })

    deduped = _dedup_timeseries_results(matched_results)
    return {"status": "success", "data": deduped}

@router.get("/search/timeseries")
def search_timeseries(keyword: str = "", start_year: int | None = None, end_year: int | None = None, db: Session = Depends(get_db)):
    """Mencari data deret waktu berdasarkan kata kunci dan rentang tahun."""
    if not keyword:
        return {"status": "success", "data": []}
    
    # Forward ke logic indicators
    kw_clean = keyword.strip()
    return timeseries_data_by_indicators(indicators=kw_clean, years=",".join(str(y) for y in range(start_year or 2015, (end_year or 2030) + 1)), db=db)

@router.get("/timeseries/browse-data")
def timeseries_browse_data(table_id: int, db: Session = Depends(get_db)):
    """Mengambil data deret waktu lengkap untuk satu tabel tertentu."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(404, "Table not found")
    doc = db.query(models.Document).filter(models.Document.id == table.document_id).first()
    year = doc.year if doc else None
    all_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).all()
    if not all_rows:
        return {"status": "success", "data": []}

    headers = get_table_headers(db, table)
    entity_key = headers[0] if headers else "Kecamatan"
    value_cols = [c for c in headers if c != entity_key]
    data_rows = []
    for r in all_rows:
        record = r.data
        ent = str(record.get(entity_key, '')).strip()
        if not ent or ent in ['-', '...']:
            continue
        ent = normalize_entity_name(ent)
        vals = {c: _normalize_indo_number(str(record.get(c, '')).strip()) for c in value_cols}
        data_rows.append({"entitas": ent, "tipe": _classify_entity_type(ent), "nilai": vals})

    data_rows.sort(key=lambda r: (r["entitas"] == "Kabupaten Tasikmalaya", r["entitas"]))
    column_years = get_column_years_from_db(db, table, year if year else 2026)
    return {"status": "success", "data": [{
        "table_id": table.id,
        "table_name": table.table_name,
        "year": year,
        "entity_key": entity_key,
        "headers": value_cols,
        "unit": _infer_unit_from_headers_and_table(value_cols, table.table_name),
        "vk_units": _build_vk_units(value_cols, table.table_name),
        "data": data_rows,
        "column_years": column_years
    }]}

@router.get("/timeseries/table-columns")
def timeseries_table_columns(table_ids: str, db: Session = Depends(get_db)):
    """Mengambil daftar kolom gabungan dari beberapa tabel untuk analisis deret waktu."""
    ids = [int(x) for x in table_ids.split(",") if x.strip()]
    if not ids:
        return {"status": "success", "entity_key": "", "columns": []}
    tables = db.query(models.ExtractedTable).filter(models.ExtractedTable.id.in_(ids)).all()
    entity_key = ""
    all_cols = {}
    for table in tables:
        headers = get_table_headers(db, table)
        if not headers:
            continue
        if not entity_key:
            entity_key = headers[0]
        for h in headers:
            if h != entity_key:
                all_cols[h.lower().strip()] = h
    return {"status": "success", "entity_key": entity_key, "columns": sorted(all_cols.values())}

@router.post("/timeseries/export-excel")
def export_timeseries_excel(req: TimeSeriesExportRequest):
    """Mengekspor data deret waktu ke file Excel dengan format yang rapi."""
    years = req.years or []
    valueKeys = req.valueKeys or []
    vkUnits = req.vkUnits or {}
    entityMap = req.entityMap or {}
    entities = req.entities or sorted(entityMap.keys())

    if not years or not valueKeys or not entityMap:
        raise HTTPException(status_code=400, detail="Data deret waktu tidak lengkap")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Deret Waktu"
    ws.views.sheetView[0].showGridLines = True

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    row1 = ["Rincian"]
    for y in years:
        row1.append(str(y))
        for _ in range(1, len(valueKeys)):
            row1.append("")
    ws.append(row1)

    row2 = [""]
    for _ in years:
        for vk in valueKeys:
            unit = f" ({vkUnits[vk]})" if vkUnits.get(vk) else ""
            row2.append(f"{vk}{unit}")
    ws.append(row2)

    ws.merge_cells(start_row=1, start_column=1, end_row=2, end_column=1)

    curr_col = 2
    for y in years:
        end_col = curr_col + len(valueKeys) - 1
        if end_col > curr_col:
            ws.merge_cells(start_row=1, start_column=curr_col, end_row=1, end_column=end_col)
        curr_col = end_col + 1

    for r_idx in (1, 2):
        ws.row_dimensions[r_idx].height = 24
        for c_idx in range(1, len(row1) + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.border = thin_border
            if r_idx == 1:
                cell.font = Font(name='Segoe UI', size=10, bold=True, color='FFFFFF')
                cell.fill = PatternFill('solid', fgColor='1E40AF')
                cell.alignment = Alignment(horizontal='center', vertical='center')
            else:
                cell.font = Font(name='Segoe UI', size=9, bold=True, color='1E3A8A')
                cell.fill = PatternFill('solid', fgColor='DBEAFE')
                cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

    for ent in entities:
        r_vals = [ent]
        for y in years:
            y_data = entityMap.get(ent, {}).get(y, entityMap.get(ent, {}).get(str(y), {}))
            for vk in valueKeys:
                raw_v = str(y_data.get(vk, "-")).strip()
                clean_num = raw_v.replace('.', '').replace(',', '.')
                try:
                    r_vals.append(float(clean_num))
                except ValueError:
                    r_vals.append(raw_v)
        ws.append(r_vals)
        r_idx = ws.max_row
        ws.row_dimensions[r_idx].height = 20
        for c_idx, cell in enumerate(ws[r_idx], 1):
            cell.font = Font(name='Segoe UI', size=10, color='1E293B')
            cell.border = thin_border
            if isinstance(cell.value, (int, float)):
                cell.alignment = Alignment(horizontal='right', vertical='center')
                cell.number_format = '#,##0.00' if isinstance(cell.value, float) and not cell.value.is_integer() else '#,##0'
            else:
                cell.alignment = Alignment(horizontal='left' if c_idx == 1 else 'center', vertical='center')

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.value is not None:
                s = str(cell.value)
                w = sum(2 if ord(ch) > 127 else 1 for ch in s)
                max_len = max(max_len, w)
        ws.column_dimensions[col_letter].width = max(min(max_len + 4, 50), 14)

    ws.freeze_panes = 'B3'
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    
    clean_vks = [re.sub(r'[\\/:*?"<>|]', '', vk).strip().replace(' ', '_') for vk in valueKeys]
    vk_str = "__".join([vk for vk in clean_vks if vk])[:60].rstrip('_') or "Deret_Waktu"
    sorted_years = sorted([int(y) for y in years if str(y).isdigit()])
    year_str = f"_{sorted_years[0]}-{sorted_years[-1]}" if len(sorted_years) > 1 else (f"_{sorted_years[0]}" if sorted_years else "")
    filename = f"Deret_Waktu_{vk_str}{year_str}.xlsx"
    filename = filename.encode("ascii", "ignore").decode("ascii").strip() or "Deret_Waktu.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
