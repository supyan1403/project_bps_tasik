import os
import re
import json
import threading
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import func

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import models
from database import get_db
from pipeline import parse_indonesian_number
from routers.auth import require_admin
from routers.tables import get_table_headers, clean_bilingual_header
from routers.timeseries import (
    extract_timeseries_year, 
    check_cell_format_anomaly
)

router = APIRouter(prefix="/api", tags=["Anomaly & Data Quality"])

_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_DATA_DIR = os.path.join(_BASE_DIR, "data")
os.makedirs(_DATA_DIR, exist_ok=True)
_TS_SAFE_PATH = os.path.join(_DATA_DIR, "safe_timeseries_anomalies.json")
_MASTER_DICT_PATH = os.path.join(_DATA_DIR, "master_dictionary.json")
_DISMISSED_PATH = os.path.join(_DATA_DIR, "dismissed_column_anomalies.json")
MASTER_COLUMNS_FILE = os.path.join(_DATA_DIR, "master_columns.json")

# In-memory TTL cache for anomaly scans
_TTL_CACHE_TTL_SECONDS = 15
_TTL_CACHE = {}
_TTL_CACHE_LOCK = threading.Lock()

def _get_ttl_cache(key: str):
    with _TTL_CACHE_LOCK:
        entry = _TTL_CACHE.get(key)
        if not entry:
            return None
        ts, value = entry
        if time.time() - ts > _TTL_CACHE_TTL_SECONDS:
            _TTL_CACHE.pop(key, None)
            return None
        return value

def _set_ttl_cache(key: str, value):
    with _TTL_CACHE_LOCK:
        _TTL_CACHE[key] = (time.time(), value)

def _clear_ttl_cache(keys=None):
    with _TTL_CACHE_LOCK:
        if keys is None:
            _TTL_CACHE.clear()
        else:
            for k in keys:
                _TTL_CACHE.pop(k, None)

def _load_ts_safe() -> set:
    if os.path.exists(_TS_SAFE_PATH):
        try:
            with open(_TS_SAFE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return set(data.get("safe_keys", [])) if isinstance(data, dict) else set(data)
        except Exception:
            return set()
    return set()

def _save_ts_safe(safe_keys: set):
    try:
        with open(_TS_SAFE_PATH, "w", encoding="utf-8") as f:
            json.dump({"safe_keys": sorted(list(safe_keys))}, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving safe timeseries: {e}")

def _load_master_dict() -> dict:
    if os.path.exists(_MASTER_DICT_PATH):
        with open(_MASTER_DICT_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"words": []}

def _save_master_dict(data: dict):
    with open(_MASTER_DICT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def _load_dismissed() -> dict:
    if os.path.exists(_DISMISSED_PATH):
        with open(_DISMISSED_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"dismissed": []}

def _save_dismissed(data: dict):
    with open(_DISMISSED_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def _load_master_columns():
    if not os.path.exists(MASTER_COLUMNS_FILE):
        return {"version": "", "document_id": None, "columns": [], "next_id": 1}
    with open(MASTER_COLUMNS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/admin/timeseries-anomalies")
def get_timeseries_anomalies(refresh: bool = False, db: Session = Depends(get_db)):
    """Scan and return all time-series anomalies in multi-year tables across the database."""
    cache_key = "timeseries-anomalies"
    if refresh:
        _clear_ttl_cache([cache_key])
    else:
        hit = _get_ttl_cache(cache_key)
        if hit is not None:
            return hit
    try:
        safe_keys = _load_ts_safe()
        tables = db.query(models.ExtractedTable).all()
        docs = {d.id: d for d in db.query(models.Document).all()}
        
        anomalies = []
        for table in tables:
            doc = docs.get(table.document_id)
            doc_year = doc.year if doc else 0
            headers = table.headers or []
            if len(headers) < 2:
                continue
                
            years_meta = table.years or []
            metric_cols = {}
            for idx, col in enumerate(headers):
                yr = None
                if idx < len(years_meta) and years_meta[idx]:
                    yr = extract_timeseries_year(years_meta[idx])
                if not yr:
                    yr = extract_timeseries_year(col)
                
                base_metric = re.sub(r'\.\d+$', '', col).strip()
                if base_metric not in metric_cols:
                    metric_cols[base_metric] = {}
                if yr:
                    metric_cols[base_metric][yr] = col
                    
            rows = db.query(models.TableRow).filter(models.TableRow.table_id == table.id).all()
            if not rows:
                continue
                
            entity_key = headers[0]
            for r in rows:
                record = r.data
                ent_name = str(record.get(entity_key, "")).strip()
                if not ent_name or ent_name.lower() in ["-", "...", "tahun", "year", "jumlah", "total"]:
                    continue
                    
                for base_metric, col_yrs in metric_cols.items():
                    if len(col_yrs) < 2:
                        continue
                    
                    year_values = {}
                    for yr, col in col_yrs.items():
                        val_raw = str(record.get(col, "")).strip()
                        if val_raw:
                            year_values[yr] = (val_raw, col)
                            
                    sorted_yrs = sorted(year_values.keys())
                    for i in range(1, len(sorted_yrs)):
                        prev_yr = sorted_yrs[i - 1]
                        curr_yr = sorted_yrs[i]
                        if curr_yr - prev_yr > 3:
                            continue
                            
                        prev_raw, prev_col = year_values[prev_yr]
                        curr_raw, curr_col = year_values[curr_yr]
                        
                        anomaly_key = f"{table.id}_{r.id}_{curr_col}_{curr_yr}"
                        alt_key = f"{table.id}_{ent_name}_{curr_col}_{curr_yr}"
                        if anomaly_key in safe_keys or alt_key in safe_keys:
                            continue
                        
                        clean_disp_metric = clean_bilingual_header(base_metric)
                        clean_disp_metric = re.sub(r'\.\d+$', '', clean_disp_metric).strip()
                        
                        err = check_cell_format_anomaly(curr_raw, prev_raw)
                        if err:
                            anomalies.append({
                                "key": anomaly_key,
                                "table_id": table.id,
                                "row_id": r.id,
                                "table_name": table.table_name,
                                "doc_year": doc_year,
                                "entitas": ent_name,
                                "indicator": curr_col,
                                "prev_indicator": prev_col,
                                "base_metric": clean_disp_metric,
                                "year": curr_yr,
                                "prev_year": prev_yr,
                                "current_val": curr_raw,
                                "prev_val": prev_raw,
                                "type": "format",
                                "severity": "high",
                                "message": f"Nilai '{ent_name}' ({clean_disp_metric}): {err}."
                            })
        payload = {"status": "success", "total_anomalies": len(anomalies), "anomalies": anomalies}
        _set_ttl_cache(cache_key, payload)
        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/timeseries-anomalies/mark-safe")
def mark_timeseries_anomaly_safe(payload: dict = Body(...), db: Session = Depends(get_db)):
    key = payload.get("key")
    table_id = payload.get("table_id")
    row_id = payload.get("row_id")
    indicator = payload.get("indicator", "")
    year = payload.get("year", "")
    entitas = payload.get("entitas", "")
    
    safe_keys = _load_ts_safe()
    if key:
        safe_keys.add(str(key))
    if table_id and row_id and indicator and year:
        safe_keys.add(f"{table_id}_{row_id}_{indicator}_{year}")
    if table_id and entitas and indicator and year:
        safe_keys.add(f"{table_id}_{entitas}_{indicator}_{year}")
        
    _save_ts_safe(safe_keys)
    
    if row_id:
        row = db.query(models.TableRow).filter(models.TableRow.id == row_id).first()
        if row and row.is_anomaly:
            row.is_anomaly = False
            db.commit()
            
    _clear_ttl_cache(["timeseries-anomalies"])
    return {"status": "success", "message": "Anomali berhasil ditandai aman."}

@router.post("/admin/timeseries-anomalies/mark-all-safe")
def mark_all_timeseries_anomalies_safe(db: Session = Depends(get_db)):
    res = get_timeseries_anomalies(db=db)
    anomalies = res.get("anomalies", [])
    safe_keys = _load_ts_safe()
    for a in anomalies:
        if a.get("key"):
            safe_keys.add(a["key"])
        if a.get("table_id") and a.get("row_id") and a.get("indicator") and a.get("year"):
            safe_keys.add(f"{a['table_id']}_{a['row_id']}_{a['indicator']}_{a['year']}")
    _save_ts_safe(safe_keys)
    _clear_ttl_cache(["timeseries-anomalies"])
    return {"status": "success", "message": f"{len(anomalies)} anomali deret waktu berhasil ditandai aman."}

@router.get("/admin/anomalies")
def get_tables_with_anomalies(db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    results = db.query(
        models.ExtractedTable.id,
        models.ExtractedTable.table_name,
        models.Document.year,
        func.count(models.TableRow.id)
    ).join(
        models.TableRow, models.ExtractedTable.id == models.TableRow.table_id
    ).join(
        models.Document, models.ExtractedTable.document_id == models.Document.id
    ).filter(
        models.TableRow.is_anomaly == True
    ).group_by(
        models.ExtractedTable.id,
        models.ExtractedTable.table_name,
        models.Document.year
    ).all()
    
    return [
        {
            "table_id": r[0],
            "table_name": r[1],
            "year": r[2],
            "anomaly_count": r[3]
        }
        for r in results
    ]

@router.get("/admin/all-data-anomalies")
def get_all_data_anomalies(db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    cache_key = "all-data-anomalies"
    hit = _get_ttl_cache(cache_key)
    if hit is not None:
        return hit
    try:
        rows = db.query(
            models.TableRow,
            models.ExtractedTable.table_name,
            models.Document.year,
            models.Document.filename
        ).join(
            models.ExtractedTable, models.TableRow.table_id == models.ExtractedTable.id
        ).join(
            models.Document, models.ExtractedTable.document_id == models.Document.id
        ).filter(
            models.TableRow.is_anomaly == True
        ).limit(100).all()
        
        results = []
        for r, table_name, doc_year, doc_name in rows:
            m = re.search(r'Tabel[\s_]*(\d+)', table_name or "", re.IGNORECASE)
            bab_num = int(m.group(1)) if m else None
            results.append({
                "row_id": r.id,
                "table_id": r.table_id,
                "table_name": table_name,
                "document_name": doc_name,
                "document_year": doc_year,
                "bab_num": bab_num,
                "data": r.data
            })
        payload = {"anomalies": results}
        _set_ttl_cache(cache_key, payload)
        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/master-dictionary")
def get_master_dictionary():
    return _load_master_dict()

@router.post("/master-dictionary/words")
def add_master_words(body: dict):
    words = body.get("words", [])
    data = _load_master_dict()
    existing = set(w.lower() for w in data["words"])
    added = []
    for w in words:
        wl = w.lower()
        if wl not in existing:
            data["words"].append(wl)
            existing.add(wl)
            added.append(w)
    _save_master_dict(data)
    return {"message": f"Added {len(added)} words", "added": added}

@router.delete("/master-dictionary/words/{word}")
def delete_master_word(word: str):
    data = _load_master_dict()
    before = len(data["words"])
    data["words"] = [w for w in data["words"] if w.lower() != word.lower()]
    _save_master_dict(data)
    return {"message": f"Removed {before - len(data['words'])} occurrences"}

@router.get("/dismissed-anomalies")
def get_dismissed_anomalies():
    return _load_dismissed()

@router.post("/dismiss-column-anomaly")
def dismiss_column_anomaly(body: dict):
    key = body.get("key", "")
    data = _load_dismissed()
    if key not in data["dismissed"]:
        data["dismissed"].append(key)
    _save_dismissed(data)
    return {"message": "Dismissed"}

@router.post("/undismiss-column-anomaly")
def undismiss_column_anomaly(body: dict):
    key = body.get("key", "")
    data = _load_dismissed()
    data["dismissed"] = [k for k in data["dismissed"] if k != key]
    _save_dismissed(data)
    return {"message": "Undismissed"}

@router.get("/admin/all-column-anomalies")
def get_all_column_anomalies(db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    cache_key = "all-column-anomalies"
    hit = _get_ttl_cache(cache_key)
    if hit is not None:
        return hit
    try:
        master = _load_master_dict()
        master_set = set(w.lower() for w in master["words"])
        dismissed = _load_dismissed()
        dismissed_set = set(dismissed["dismissed"])
        
        try:
            master_cols_data = _load_master_columns()
            master_cols = set(c["standard"].lower().strip() for c in master_cols_data.get("columns", []) if "standard" in c)
        except Exception:
            master_cols = set()
        
        tables = db.query(
            models.ExtractedTable,
            models.Document.year,
            models.Document.filename
        ).join(
            models.Document,
            models.ExtractedTable.document_id == models.Document.id
        ).all()
        
        all_anomalies = []
        for table, doc_year, doc_name in tables:
            headers = get_table_headers(db, table)
            if not headers:
                continue
            
            m = re.search(r'Tabel[\s_]*(\d+)', table.table_name or "", re.IGNORECASE)
            bab_num = int(m.group(1)) if m else None
            
            for idx, h in enumerate(headers):
                if idx == 0:
                    continue
                h_clean = re.sub(r'\.\d+$', '', h)
                if h_clean.lower().strip() in master_cols:
                    continue
                key = f"{table.id}:{idx}:{h}"
                if key in dismissed_set:
                    continue
                words = re.findall(r'[a-zA-Z]+', h)
                unknown = [w for w in words if w.lower() not in master_set]
                if unknown:
                    all_anomalies.append({
                        "table_id": table.id,
                        "table_name": table.table_name,
                        "document_name": doc_name,
                        "document_year": doc_year,
                        "bab_num": bab_num,
                        "col_index": idx,
                        "header": h,
                        "unknown_words": unknown,
                        "key": key,
                    })
        payload = {"anomalies": all_anomalies}
        _set_ttl_cache(cache_key, payload)
        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tables/{table_id}/column-anomalies")
def get_column_anomalies(table_id: int, db: Session = Depends(get_db)):
    master = _load_master_dict()
    master_set = set(w.lower() for w in master["words"])
    dismissed = _load_dismissed()
    dismissed_set = set(dismissed["dismissed"])
    
    try:
        master_cols_data = _load_master_columns()
        master_cols = set(c["standard"].lower().strip() for c in master_cols_data.get("columns", []) if "standard" in c)
    except Exception:
        master_cols = set()
    
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(404, "Table not found")
    
    headers = get_table_headers(db, table)
    if not headers:
        return {"anomalies": [], "headers": []}
    
    anomalies = []
    for idx, h in enumerate(headers):
        h_clean = re.sub(r'\.\d+$', '', h)
        if h_clean.lower().strip() in master_cols:
            continue
        key = f"{table_id}:{idx}:{h}"
        if key in dismissed_set:
            continue
        words = re.findall(r'[a-zA-Z]+', h)
        unknown = [w for w in words if w.lower() not in master_set]
        if unknown:
            anomalies.append({
                "col_index": idx,
                "header": h,
                "unknown_words": unknown,
                "key": key
            })
    return {"anomalies": anomalies, "headers": headers}

@router.post("/tables/{table_id}/apply-column-fix")
def apply_column_fix(table_id: int, body: dict, db: Session = Depends(get_db)):
    col_index = body.get("col_index")
    new_name = body.get("new_name", "").strip()
    if col_index is None or not new_name:
        raise HTTPException(400, "col_index and new_name required")
    
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(404, "Table not found")
    
    headers = get_table_headers(db, table)
    if not headers or col_index >= len(headers):
        raise HTTPException(status_code=400, detail="Index kolom di luar batas")
    old_header_orig = headers[col_index]
    if old_header_orig == new_name:
        raise HTTPException(status_code=400, detail="Nama kolom sama, tidak ada perubahan")
    
    try:
        all_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).all()
        for r in all_rows:
            if old_header_orig in r.data:
                new_data = {}
                for k, v in r.data.items():
                    new_data[new_name if k == old_header_orig else k] = v
                r.data = new_data
        
        if table.headers:
            new_headers = [new_name if h == old_header_orig else h for h in table.headers]
            table.headers = new_headers
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    dismiss_key = f"{table_id}:{col_index}:{old_header_orig}"
    dismissed = _load_dismissed()
    if dismiss_key not in dismissed["dismissed"]:
        dismissed["dismissed"].append(dismiss_key)
    _save_dismissed(dismissed)
    
    return {"message": f"Column {col_index} renamed to '{new_name}'"}
