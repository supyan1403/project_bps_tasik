import os
import re
import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import models
from database import get_db
from routers.tables import get_table_headers
from routers.timeseries import (
    get_clean_table_name,
    _infer_unit_from_indicator
)

router = APIRouter(prefix="/api", tags=["Master Columns & Dictionaries"])

_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_DATA_DIR = os.path.join(_BASE_DIR, "data")
os.makedirs(_DATA_DIR, exist_ok=True)
MASTER_COLUMNS_FILE = os.path.join(_DATA_DIR, "master_columns.json")

MONTH_PATTERN = r'(?:Jan(?:uari)?|Feb(?:ruari)?|Mar(?:et)?|Apr(?:il)?|Mei|Jun(?:i)?|Jul(?:i)?|Ag(?:ustus)?t?|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Des(?:ember)?)'

def _load_master_columns() -> dict:
    if not os.path.exists(MASTER_COLUMNS_FILE):
        return {"version": "", "document_id": None, "columns": [], "next_id": 1}
    with open(MASTER_COLUMNS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def _save_master_columns(data: dict):
    with open(MASTER_COLUMNS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def _get_master_col_unit_map() -> dict:
    data = _load_master_columns()
    return {c["standard"].lower().strip(): c.get("unit", "") for c in data.get("columns", []) if "standard" in c}

def _clean_header_for_master(header: str) -> str:
    if not header:
        return header
    h = header.strip()
    while True:
        prev = h
        h = re.sub(r'\.\d+(?:\s*\([^)]*\))?\s*$', '', h)
        h = re.sub(r'[\s,;–—(\-]+\d{4}(?:\s*[–\-/]\s*\d{4})?\s*\)?\s*$', '', h)
        h = re.sub(r'[\s,;–—-]+' + MONTH_PATTERN + r'\s*$', '', h)
        h = h.strip().rstrip('-,;')
        if h == prev:
            break
    return h

def _tokenize(name: str) -> set:
    return set(re.findall(r'[\w]+', (name or "").lower()))

_STOP_TITLE = {
    "tabel", "jumlah", "menurut", "dan", "di", "per", "jenis", "untuk", "dengan",
    "pada", "dari", "yang", "serta", "atau", "tahun", "kabupaten", "tasikmalaya",
    "indonesia", "provinsi", "jawa", "barat", "hal", "sd", "kelurahan",
}

def _title_keywords(table_name: str) -> list:
    clean = get_clean_table_name(table_name)
    toks = re.findall(r'[\w]+', clean.lower())
    return [t for t in toks if t not in _STOP_TITLE and len(t) >= 3]

def _match_single_header(header: str, title_keywords: list, master_cols: list) -> dict:
    import difflib
    h_clean = _clean_header_for_master(header)
    h_lower = h_clean.lower().strip()
    if not h_lower:
        return {"suggested": None, "confidence": 0.0, "score": 0}

    h_tokens = _tokenize(h_clean)
    best = None
    best_score = 0.0

    for col in master_cols:
        std = col.get("standard", "")
        std_lower = std.lower().strip()
        if not std_lower:
            continue

        score = 0.0
        if h_lower == std_lower:
            score = 1.0
        else:
            aliases = [a.lower().strip() for a in col.get("aliases", [])]
            if h_lower in aliases:
                score = 1.0

        if score == 0.0:
            std_tokens = _tokenize(std)
            char_sim = difflib.SequenceMatcher(None, h_lower, std_lower).ratio()
            token_sim = (len(h_tokens & std_tokens) / (len(h_tokens | std_tokens) or 1)) if std_tokens else 0.0
            title_bonus = 0.0
            if title_keywords:
                std_joined = " ".join(std_tokens)
                hit = sum(1 for kw in title_keywords if kw in std_joined)
                title_bonus = min(hit / len(title_keywords), 0.3)
            score = 0.55 * char_sim + 0.30 * token_sim + 0.15 * title_bonus

        if score > best_score:
            best_score = score
            best = col

    if best is None or best_score < 0.45:
        return {"suggested": None, "confidence": 0.0, "score": best_score}

    return {
        "suggested": best["standard"],
        "confidence": round(best_score, 3),
        "score": round(best_score, 3)
    }

def suggest_master_columns(db: Session, table) -> list:
    headers = get_table_headers(db, table)
    if not headers:
        return []
    master = _load_master_columns().get("columns", [])
    title_keywords = _title_keywords(table.table_name)
    suggestions = []
    for idx, h in enumerate(headers):
        if idx == 0:
            suggestions.append({
                "col_index": idx,
                "header": h,
                "suggested": None,
                "is_entity": True,
                "confidence": 1.0,
                "score": 1.0
            })
            continue
        res = _match_single_header(h, title_keywords, master)
        suggestions.append({
            "col_index": idx,
            "header": h,
            "suggested": res.get("suggested"),
            "is_entity": False,
            "confidence": res.get("confidence"),
            "score": res.get("score")
        })
    return suggestions

@router.get("/documents/by-year")
def get_document_by_year(year: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.year == year).first()
    if not doc:
        raise HTTPException(404, f"No document found for year {year}")
    return {"id": doc.id, "filename": doc.filename, "year": doc.year, "status": doc.status}

@router.get("/master/columns/usage")
def get_column_usage(column_name: str, db: Session = Depends(get_db)):
    target = column_name.lower().strip()
    tables = db.query(
        models.ExtractedTable,
        models.Document.year,
        models.Document.filename
    ).join(
        models.Document,
        models.ExtractedTable.document_id == models.Document.id
    ).all()
    
    matching_tables = []
    for t, doc_year, doc_name in tables:
        headers = get_table_headers(db, t)
        if not headers:
            continue
        for h in headers:
            h_clean = re.sub(r'\.\d+$', '', h).lower().strip()
            if h_clean == target:
                matching_tables.append({
                    "id": t.id,
                    "table_name": t.table_name,
                    "document_name": doc_name,
                    "document_year": doc_year
                })
                break
    return {"tables": matching_tables}

@router.get("/master/columns/search")
def search_columns_global(q: str = "", limit_headers: int = 50, limit_tables: int = 20, db: Session = Depends(get_db)):
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Minimal 2 karakter")

    q_lower = q.lower().strip()
    q_no_space = q_lower.replace(" ", "")
    words = [w for w in q_lower.split() if len(w.strip()) >= 2] or [q_lower]
    master_unit_map = _get_master_col_unit_map()

    tables_with_docs = db.query(
        models.ExtractedTable,
        models.Document.year,
        models.Document.filename
    ).join(
        models.Document,
        models.ExtractedTable.document_id == models.Document.id
    ).all()

    header_groups = {}
    for t, doc_year, doc_name in tables_with_docs:
        headers = get_table_headers(db, t)
        if not headers:
            continue
        table_years = list(t.years) if t.years else []
        for i, h in enumerate(headers):
            h_clean = re.sub(r'\.\d+$', '', h).lower().strip()
            if not h_clean:
                continue

            score = 0
            if q_no_space and q_no_space in h_clean.replace(" ", ""):
                score = 100
            else:
                matched = sum(1 for w in words if w in h_clean)
                if matched == len(words):
                    score = 50 + (10 * matched)
                elif matched > 0:
                    score = matched * 5
            if score <= 0:
                continue

            if h_clean not in header_groups:
                header_groups[h_clean] = {
                    "header": h,
                    "unit": master_unit_map.get(h_clean, ""),
                    "score": score,
                    "matches": []
                }
            else:
                if score > header_groups[h_clean]["score"]:
                    header_groups[h_clean]["score"] = score

            header_groups[h_clean]["matches"].append({
                "table_id": t.id,
                "table_name": t.table_name,
                "table_year": table_years[i] if i < len(table_years) else None,
                "doc_year": doc_year,
                "doc_name": doc_name
            })

    results = sorted(header_groups.values(), key=lambda g: (-g["score"], -len(g["matches"])))[:max(1, limit_headers)]
    for g in results:
        g["matches"] = g["matches"][:max(1, limit_tables)]

    return {
        "status": "success",
        "query": q,
        "total": len(header_groups),
        "results": results
    }

@router.get("/search/rows")
def search_rows_all_tables(q: str = "", limit_tables: int = 50, limit_rows: int = 10, db: Session = Depends(get_db)):
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Minimal 2 karakter")

    q_lower = q.lower().strip()
    words = [w for w in q_lower.split() if len(w.strip()) >= 2] or [q_lower]

    tables_with_docs = db.query(
        models.ExtractedTable,
        models.Document.year,
        models.Document.filename
    ).join(
        models.Document,
        models.ExtractedTable.document_id == models.Document.id
    ).all()

    def cell_matches(val) -> bool:
        if val is None:
            return False
        s = str(val).lower()
        return bool(s) and all(w in s for w in words)

    results = []
    for t, doc_year, doc_name in tables_with_docs:
        headers = get_table_headers(db, t)
        if not headers:
            continue
        entity_key = headers[0]
        rows = db.query(models.TableRow).filter(
            models.TableRow.table_id == t.id
        ).order_by(models.TableRow.sort_order.asc(), models.TableRow.id.asc()).all()
        if not rows:
            continue

        row_matches = []
        for r in rows:
            data = r.data or {}
            matched_cols = [str(k) for k, v in data.items() if cell_matches(v)]
            if matched_cols:
                ent_val = str(data.get(entity_key, "")).strip()
                row_matches.append({
                    "entity": ent_val,
                    "columns": matched_cols,
                    "row": data
                })
                if len(row_matches) >= limit_rows:
                    break

        if row_matches:
            results.append({
                "table_id": t.id,
                "table_name": t.table_name,
                "doc_year": doc_year,
                "doc_name": doc_name,
                "entity_key": entity_key,
                "count": len(row_matches),
                "matches": row_matches
            })
        if len(results) >= limit_tables:
            break

    return {
        "status": "success",
        "query": q,
        "total": len(results),
        "results": results
    }

@router.post("/master/regenerate-columns")
def regenerate_master_columns(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    tables = db.query(models.ExtractedTable).filter(
        models.ExtractedTable.document_id == document_id
    ).all()

    all_headers = {}
    for t in tables:
        headers = get_table_headers(db, t)
        units_list = t.units if t.units and isinstance(t.units, list) else []
        if not headers:
            continue
        for idx_h, h in enumerate(headers):
            h_clean = _clean_header_for_master(h)
            if not h_clean:
                continue
            key = h_clean.lower()
            u_val = ""
            if units_list and idx_h < len(units_list) and units_list[idx_h]:
                raw_u = str(units_list[idx_h]).strip()
                if raw_u not in ['-', 'satuan', '']:
                    u_val = raw_u
            if key not in all_headers:
                all_headers[key] = {"standard": h_clean, "count": 0, "unit": u_val}
            all_headers[key]["count"] += 1
            if not all_headers[key]["unit"] and u_val:
                all_headers[key]["unit"] = u_val

    sorted_headers = sorted(all_headers.values(), key=lambda x: -x["count"])
    columns_out = []
    for idx, h in enumerate(sorted_headers):
        unit_val = h.get("unit") or _infer_unit_from_indicator(h["standard"])
        columns_out.append({"id": idx + 1, "standard": h["standard"], "unit": unit_val, "count": h["count"]})

    data = {
        "version": str(doc.year),
        "document_id": document_id,
        "document_name": doc.filename,
        "columns": columns_out,
        "next_id": len(columns_out) + 1
    }
    _save_master_columns(data)
    return {"message": f"Master columns regenerated from {doc.filename}", "total": len(columns_out)}

@router.get("/master/columns")
def get_master_columns(db: Session = Depends(get_db)):
    data = _load_master_columns()
    try:
        tables = db.query(models.ExtractedTable).all()
        all_headers = {}
        for t in tables:
            headers = get_table_headers(db, t)
            for h in headers:
                h_clean = re.sub(r'\.\d+$', '', h).lower().strip()
                all_headers[h_clean] = all_headers.get(h_clean, 0) + 1
        for col in data.get("columns", []):
            std_lower = col["standard"].lower().strip()
            cnt = all_headers.get(std_lower, 0)
            for alias in col.get("aliases", []):
                cnt += all_headers.get(alias.lower().strip(), 0)
            col["count"] = cnt
    except Exception:
        pass
    return data

@router.get("/tables/{table_id}/master-suggestions")
def get_table_master_suggestions(table_id: int, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(404, "Table not found")
    return {"suggestions": suggest_master_columns(db, table)}

@router.post("/tables/{table_id}/apply-master-mapping")
def apply_master_mapping(table_id: int, body: dict, db: Session = Depends(get_db)):
    mapping = body.get("mapping", {})
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(404, "Table not found")

    headers = get_table_headers(db, table)
    if not headers:
        raise HTTPException(400, "Tabel tidak memiliki kolom")

    new_headers = list(headers)
    changes = []
    for idx_str, master_name in mapping.items():
        try:
            idx = int(idx_str)
        except (ValueError, TypeError):
            continue
        master_name = (master_name or "").strip()
        if not master_name or idx < 0 or idx >= len(new_headers):
            continue
        old = new_headers[idx]
        if old == master_name:
            continue
        new_headers[idx] = master_name
        changes.append({"col_index": idx, "old": old, "new": master_name})

    if not changes:
        return {"message": "Tidak ada perubahan kolom", "changed": []}

    all_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).all()
    for r in all_rows:
        if not isinstance(r.data, dict):
            continue
        new_data = {}
        for i, old_key in enumerate(headers):
            new_key = new_headers[i] if i < len(new_headers) else old_key
            new_data[new_key] = r.data.get(old_key, "")
        r.data = new_data

    table.headers = new_headers
    db.commit()

    return {
        "message": f"{len(changes)} kolom berhasil disesuaikan ke master kolom",
        "changed": changes
    }

@router.get("/master/columns/lookup")
def lookup_master_column_unit(column_name: str):
    data = _load_master_columns()
    name_lower = column_name.lower().strip()
    for col in data.get("columns", []):
        std = col.get("standard", "").lower().strip()
        aliases = [a.lower().strip() for a in col.get("aliases", [])]
        if name_lower == std or name_lower in aliases:
            return {"column": column_name, "standard": col.get("standard"), "unit": col.get("unit", "")}
    return {"column": column_name, "standard": None, "unit": ""}
