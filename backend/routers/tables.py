import csv
import io
import logging
import os
import re
from typing import Any

import models
import openpyxl
import schemas
from database import get_db
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from pydantic import BaseModel
from routers.auth import log_activity, require_admin
from services.table_service import (
    get_safe_windows_path,
    parse_csv_for_db,
    sanitize_row_data,
)
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from pipeline import ENGLISH_ONLY_WORDS, INDO_SAFE_WORDS, deduplicate_columns

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Tables & Editor"])

def clean_bilingual_header(header: str) -> str:
    if not header:
        return header
    header = re.sub(r'\.\d+', '', header)
    words = header.strip().split()
    if len(words) <= 1:
        return header

    while words:
        last_clean = re.sub(r'[^a-z]', '', words[-1].lower())
        if last_clean in ENGLISH_ONLY_WORDS and last_clean not in INDO_SAFE_WORDS:
            words.pop()
        else:
            break

    while len(words) > 1:
        last_word_lower = words[-1].lower()
        last_clean = re.sub(r'[^a-z]', '', last_word_lower)
        if last_clean in ENGLISH_ONLY_WORDS and last_clean not in INDO_SAFE_WORDS and last_word_lower in [w.lower() for w in words[:-1]]:
            words.pop()
            continue
        break

    deduped = []
    for w in words:
        if not deduped or w.lower() != deduped[-1].lower():
            deduped.append(w)

    result = " ".join(deduped).strip()
    return result if result else header

def get_table_headers(db: Session, table) -> list[str]:
    """Mengambil daftar header kolom dari tabel, dari metadata atau baris data pertama."""
    if table and table.headers:
        return list(table.headers)
    if table:
        row = db.query(models.TableRow).filter(models.TableRow.table_id == table.id).first()
        if row and row.data:
            return list(row.data.keys())
    return []

def normalize_record_first_col(record: dict, headers: list):
    """Menormalisasi spasi pada nilai kolom pertama (kolom entitas) di record."""
    if not headers or not record:
        return
    first_key = headers[0]
    val = record.get(first_key)
    if val is not None:
        record[first_key] = str(val).strip()

@router.get("/tables/{table_id}/snippet")
def get_table_snippet(table_id: int, response: Response, db: Session = Depends(get_db)):
    """Mengambil cuplikan singkat tabel untuk pratinjau di frontend."""
    response.headers["Cache-Control"] = "public, s-maxage=300, stale-while-revalidate=600"
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    
    doc = db.query(models.Document).filter(models.Document.id == table.document_id).first() if table.document_id else None
    try:
        orig_headers = get_table_headers(db, table) or []
        headers = [clean_bilingual_header(h) for h in orig_headers]
        units = list(table.units) if table.units else [""] * len(orig_headers)
        
        total_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).count()
        first_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).order_by(models.TableRow.sort_order.asc(), models.TableRow.id.asc()).limit(5).all()
        data_rows = [[r.data.get(h, "") for h in orig_headers] for r in first_rows]
        
        return {
            "table_id": table.id,
            "table_name": table.table_name,
            "document_name": doc.filename if doc else None,
            "document_year": doc.year if doc else None,
            "bab_num": table.bab_num if hasattr(table, "bab_num") else None,
            "total_rows": total_rows,
            "total_cols": len(headers),
            "headers": headers,
            "units": units,
            "rows": data_rows
        }
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tables")
def create_new_table(req: schemas.CreateTableRequest, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Membuat tabel baru beserta baris data awal dari dokumen publikasi."""
    doc = db.query(models.Document).filter(models.Document.id == req.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen publikasi tidak ditemukan.")

    headers = [h.strip() for h in req.headers if h.strip()]
    if not headers:
        headers = ["Kecamatan", "Nilai"]

    units = list(req.units) if req.units else [""] * len(headers)
    while len(units) < len(headers):
        units.append("")

    years = list(req.years) if req.years else [str(doc.year or "")] * len(headers)
    while len(years) < len(headers):
        years.append(str(doc.year or ""))

    if units and units[0].lower() not in ["satuan", "unit"]:
        units[0] = "satuan"
    if years and years[0].lower() not in ["tahun", "year"]:
        years[0] = "tahun"

    new_table = models.ExtractedTable(
        document_id=doc.id,
        table_name=req.table_name.strip(),
        csv_path="",
        headers=headers,
        units=units,
        years=years
    )
    db.add(new_table)
    db.flush()

    initial_rows = []
    entity_col = headers[0]

    if req.rows and len(req.rows) > 0:
        for idx, r_data in enumerate(req.rows):
            row_dict = {h: r_data.get(h, "") for h in headers}
            initial_rows.append(models.TableRow(
                table_id=new_table.id,
                data=row_dict,
                is_anomaly=False,
                sort_order=idx
            ))
    elif req.custom_entities and len(req.custom_entities) > 0:
        for idx, item in enumerate(req.custom_entities):
            if not item.strip():
                continue
            row_dict = {h: "" for h in headers}
            row_dict[entity_col] = item.strip()
            initial_rows.append(models.TableRow(
                table_id=new_table.id,
                data=row_dict,
                is_anomaly=False,
                sort_order=idx
            ))
    else:
        for idx in range(10):
            row_dict = {h: "" for h in headers}
            initial_rows.append(models.TableRow(
                table_id=new_table.id,
                data=row_dict,
                is_anomaly=False,
                sort_order=idx
            ))

    db.bulk_save_objects(initial_rows)
    db.commit()
    db.refresh(new_table)
    log_activity(db, "create_table", new_table.table_name, {"table_id": new_table.id, "doc_id": doc.id})
    return {"message": "Tabel berhasil dibuat", "table_id": new_table.id, "table_name": new_table.table_name}

@router.delete("/tables/{table_id}")
def delete_single_table(table_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menghapus satu tabel beserta semua baris datanya dari database."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    tname = table.table_name
    db.query(models.TableRow).filter(models.TableRow.table_id == table_id).delete()
    db.delete(table)
    db.commit()
    log_activity(db, "delete_table", tname or f"id={table_id}")
    return {"message": "Tabel berhasil dihapus"}

@router.get("/tables/{table_id}/excel")
@router.get("/tables/{table_id}/export_excel")
def download_table_excel(table_id: int, db: Session = Depends(get_db)):
    """Mengunduh tabel sebagai file Excel (.xlsx) dengan format yang rapi."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    
    headers = get_table_headers(db, table)
    if not headers:
        raise HTTPException(status_code=404, detail="Tabel tidak memiliki data kolom")
    
    units = list(table.units) if table.units else [""] * len(headers)
    years = list(table.years) if table.years else [""] * len(headers)
    while len(units) < len(headers): units.append("")
    while len(years) < len(headers): years.append("")

    all_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).order_by(models.TableRow.sort_order.asc(), models.TableRow.id.asc()).all()
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = re.sub(r'[\\/?*\[\]:]', ' ', (table.table_name or "Tabel"))[:31]
    ws.views.sheetView[0].showGridLines = True

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    ws.append(headers)
    ws.row_dimensions[1].height = 26
    for col_idx, cell in enumerate(ws[1], 1):
        cell.font = Font(name='Segoe UI', size=10, bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='1E40AF')
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = thin_border

    has_units = any(str(u).strip() for u in units)
    if has_units:
        ws.append(units)
        u_row = ws.max_row
        ws.row_dimensions[u_row].height = 20
        for cell in ws[u_row]:
            cell.font = Font(name='Segoe UI', size=9, italic=True, color='475569')
            cell.fill = PatternFill('solid', fgColor='F1F5F9')
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = thin_border

    for r in all_rows:
        row_vals = []
        for h in headers:
            val_str = str(r.data.get(h, "")).strip() if isinstance(r.data, dict) else ""
            clean_num = val_str.replace('.', '').replace(',', '.')
            try:
                row_vals.append(float(clean_num))
            except ValueError:
                row_vals.append(val_str)
        ws.append(row_vals)
        r_idx = ws.max_row
        ws.row_dimensions[r_idx].height = 20
        for col_idx, cell in enumerate(ws[r_idx], 1):
            cell.font = Font(name='Segoe UI', size=10, color='1E293B')
            cell.border = thin_border
            if isinstance(cell.value, (int, float)):
                cell.alignment = Alignment(horizontal='right', vertical='center')
                cell.number_format = '#,##0.00' if isinstance(cell.value, float) and not cell.value.is_integer() else '#,##0'
            else:
                cell.alignment = Alignment(horizontal='left' if col_idx == 1 else 'center', vertical='center')

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.value is not None:
                s = str(cell.value)
                w = sum(2 if ord(ch) > 127 else 1 for ch in s)
                max_len = max(max_len, w)
        ws.column_dimensions[col_letter].width = max(min(max_len + 4, 60), 14)

    ws.freeze_panes = 'A3' if has_units else 'A2'
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    
    clean_title = re.sub(r'[\\/:*?"<>|]', '_', (table.table_name or f"tabel_{table_id}")).strip()
    clean_title = clean_title.encode("ascii", "ignore").decode("ascii").strip() or f"tabel_{table_id}"
    filename = f"{clean_title}.xlsx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/tables/{table_id}/csv")
def download_table_csv(table_id: int, db: Session = Depends(get_db)):
    """Mengunduh tabel sebagai file CSV dengan BOM UTF-8."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    
    headers = get_table_headers(db, table)
    if not headers:
        raise HTTPException(status_code=404, detail="Tabel tidak memiliki data kolom")
    
    units = table.units or [""] * len(headers)
    years = table.years or [""] * len(headers)
    all_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).order_by(models.TableRow.sort_order.asc(), models.TableRow.id.asc()).all()
    
    buf = io.StringIO()
    buf.write('\ufeffsep=,\r\n')
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerow(units)
    writer.writerow(years)
    for r in all_rows:
        writer.writerow([r.data.get(h, "") for h in headers])
    buf.seek(0)
    
    filename = re.sub(r'[\\/:*?"<>|]', '_', (table.table_name or f"tabel_{table_id}")) + ".csv"
    filename = filename.encode("ascii", "ignore").decode("ascii").strip() or f"tabel_{table_id}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/tables/{table_id}/csv_preview")
def preview_table_csv(table_id: int, db: Session = Depends(get_db)):
    """Mengambil pratinjau seluruh data tabel dalam format CSV untuk editor."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    
    try:
        orig_headers = get_table_headers(db, table)
        if not orig_headers:
            return {"headers": [], "units": [], "years": [], "rows": []}
        
        units = list(table.units) if table.units else [""] * len(orig_headers)
        years = list(table.years) if table.years else [""] * len(orig_headers)
        units = ["%" if str(u).lower() in ["persen", "persentase", "percent"] else u for u in units]
        headers = [clean_bilingual_header(h) for h in orig_headers]
        
        def _get_row_cell(rec, h_name):
            if not rec:
                return ""
            val = rec.get(h_name)
            if (val is None or str(val).strip() == "") and f"{h_name}.1" in rec:
                val = rec.get(f"{h_name}.1")
            return val if val is not None else ""

        all_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).order_by(models.TableRow.sort_order.asc(), models.TableRow.id.asc()).all()
        data_rows = [[_get_row_cell(r.data, h) for h in orig_headers] for r in all_rows]
        
        return {
            "table_id": table.id,
            "table_name": table.table_name,
            "headers": headers,
            "orig_headers": orig_headers,
            "units": units, 
            "years": years, 
            "rows": data_rows,
            "row_ids": [r.id for r in all_rows],
            "is_anomalies": [bool(r.is_anomaly) for r in all_rows]
        }
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

class CSVRowUpdate(BaseModel):
    data: list[str]

@router.put("/tables/{table_id}/csv/row/{row_index}")
def update_csv_row(table_id: int, row_index: int, payload: CSVRowUpdate, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Memperbarui data baris tertentu pada tabel berdasarkan indeks."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    headers = get_table_headers(db, table)
    if not headers:
        raise HTTPException(status_code=400, detail="Tabel tidak memiliki kolom")
    
    rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).order_by(models.TableRow.sort_order.asc(), models.TableRow.id.asc()).all()
    if row_index >= len(rows):
        raise HTTPException(status_code=400, detail="Row index out of range")
    
    new_data = {}
    for i, h in enumerate(headers):
        new_data[h] = payload.data[i] if i < len(payload.data) else ""
    rows[row_index].data = new_data
    db.commit()
    return {"message": "Row updated successfully"}

@router.delete("/tables/{table_id}/csv/row/{row_index}")
def delete_csv_row(table_id: int, row_index: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menghapus baris tertentu dari tabel berdasarkan indeks."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    
    rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).order_by(models.TableRow.sort_order.asc(), models.TableRow.id.asc()).all()
    if row_index >= len(rows):
        raise HTTPException(status_code=400, detail="Row index out of range")
    db.delete(rows[row_index])
    db.commit()
    return {"message": "Row deleted successfully"}

@router.post("/tables/{table_id}/csv/insert_row/{row_index}")
def insert_csv_row(table_id: int, row_index: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menyisipkan baris kosong baru pada posisi indeks tertentu di tabel."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    headers = get_table_headers(db, table)
    row_index = max(row_index, 0)
    
    rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).order_by(models.TableRow.sort_order.asc(), models.TableRow.id.asc()).all()
    if row_index >= len(rows):
        new_sort = (rows[-1].sort_order + 1) if rows else 0
    else:
        new_sort = rows[row_index].sort_order
        cursor = rows[row_index].sort_order
        for r in rows[row_index:]:
            r.sort_order = cursor + 1
            cursor += 1
    
    new_data = {h: "" for h in headers}
    normalize_record_first_col(new_data, headers)
    new_row = models.TableRow(table_id=table_id, data=new_data, is_anomaly=True, sort_order=new_sort)
    db.add(new_row)
    db.commit()
    return {"message": "Row inserted successfully", "insert_index": row_index}

@router.post("/tables/{table_id}/csv/row")
def add_csv_row(table_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menambahkan baris baru di awal tabel."""
    return insert_csv_row(table_id, 0, db)

class CSVColumnAdd(BaseModel):
    column_name: str
    position: Any = "end"

@router.post("/tables/{table_id}/csv/column")
def add_csv_column(table_id: int, payload: CSVColumnAdd, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menambahkan kolom baru ke tabel pada posisi yang ditentukan."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    
    headers = get_table_headers(db, table)
    col_name = payload.column_name.strip()
    if not col_name:
        raise HTTPException(status_code=400, detail="Nama kolom tidak boleh kosong")
    if col_name in headers:
        raise HTTPException(status_code=400, detail=f"Kolom '{col_name}' sudah ada")
    
    pos_config = payload.position
    insert_idx = len(headers)
    if pos_config == "start":
        insert_idx = 0
    elif pos_config == "end":
        insert_idx = len(headers)
    elif isinstance(pos_config, int):
        insert_idx = max(0, min(pos_config, len(headers)))
    elif isinstance(pos_config, dict):
        if "after_column" in pos_config:
            target = pos_config["after_column"]
            if target in headers:
                insert_idx = headers.index(target) + 1
            else:
                raise HTTPException(status_code=400, detail=f"Kolom '{target}' tidak ditemukan")
        elif "before_column" in pos_config:
            target = pos_config["before_column"]
            if target in headers:
                insert_idx = headers.index(target)
            else:
                raise HTTPException(status_code=400, detail=f"Kolom '{target}' tidak ditemukan")
    
    all_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).all()
    for r in all_rows:
        new_data = {}
        for i, h in enumerate(headers):
            if i == insert_idx:
                new_data[col_name] = ""
            new_data[h] = r.data.get(h, "")
        if insert_idx >= len(headers):
            new_data[col_name] = ""
        r.data = new_data
    
    table.headers = headers[:insert_idx] + [col_name] + headers[insert_idx:]
    units = list(table.units) if table.units else [""] * len(headers)
    years = list(table.years) if table.years else [""] * len(headers)
    table.units = units[:insert_idx] + [""] + units[insert_idx:]
    table.years = years[:insert_idx] + [""] + years[insert_idx:]
    db.commit()
    return {"message": "Column added successfully", "insert_index": insert_idx}

@router.delete("/tables/{table_id}/csv/column/{col_index}")
def delete_csv_column(table_id: int, col_index: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menghapus kolom tertentu dari tabel berdasarkan indeks."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    
    headers = get_table_headers(db, table)
    if col_index >= len(headers):
        raise HTTPException(status_code=400, detail="Column index out of range")
    col_name = headers[col_index]
    
    all_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).all()
    for r in all_rows:
        r.data = {k: v for k, v in r.data.items() if k != col_name}
    
    table.headers = [h for h in headers if h != col_name]
    if table.units:
        table.units = [u for i, u in enumerate(table.units) if i != col_index]
    if table.years:
        table.years = [y for i, y in enumerate(table.years) if i != col_index]
    db.commit()
    return {"message": "Column deleted successfully"}

class TableRenamePayload(BaseModel):
    new_name: str

@router.put("/tables/{table_id}/rename")
def rename_table(table_id: int, payload: TableRenamePayload, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Mengganti nama tabel."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    table.table_name = payload.new_name.strip()
    db.commit()
    return {"message": "Table renamed successfully", "new_name": table.table_name}

class ColumnRenamePayload(BaseModel):
    col_index: int
    new_name: str

@router.put("/tables/{table_id}/csv/rename_column")
def rename_csv_column(table_id: int, payload: ColumnRenamePayload, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Mengganti nama kolom pada tabel."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    headers = get_table_headers(db, table)
    if not headers or payload.col_index >= len(headers):
        raise HTTPException(status_code=400, detail="Index kolom di luar batas")
    old_name = headers[payload.col_index]
    new_name = payload.new_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Nama kolom baru tidak boleh kosong")
    if new_name == old_name:
        return {"message": "Column renamed", "old_name": old_name, "new_name": new_name}
    
    all_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).all()
    for r in all_rows:
        if old_name in r.data:
            new_data = {}
            for k, v in r.data.items():
                new_data[new_name if k == old_name else k] = v
            r.data = new_data
    
    if table.headers:
        new_headers = list(table.headers)
        new_headers[payload.col_index] = new_name
        table.headers = new_headers
    db.commit()
    return {"message": "Column renamed", "old_name": old_name, "new_name": new_name}

class CSVSavePayload(BaseModel):
    headers: list[str]
    units: list[str]
    years: list[str]
    rows: list[list[str]]

@router.put("/tables/{table_id}/csv/save")
def save_table_csv_all(table_id: int, payload: CSVSavePayload, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menyimpan seluruh data tabel (header, unit, tahun, baris) sekaligus."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabel tidak ditemukan")
    
    if not payload.headers or all(not h.strip() for h in payload.headers):
        raise HTTPException(status_code=400, detail="Data headers tidak boleh kosong")
        
    try:
        units = list(payload.units)
        years = list(payload.years)
        if len(units) > 0:
            units[0] = "satuan"
        if len(years) > 0:
            years[0] = "tahun"
            
        for idx in range(len(units)):
            if units[idx].lower() in ["persen", "persentase", "percent"]:
                units[idx] = "%"
        headers = deduplicate_columns(payload.headers)
        
        table.headers = headers
        table.units = units
        table.years = years
        
        db.query(models.TableRow).filter(models.TableRow.table_id == table_id).delete()
        table_rows_to_add = []
        for row_arr_idx, row_arr in enumerate(payload.rows):
            record = {}
            for i, h in enumerate(headers):
                record[h] = row_arr[i] if i < len(row_arr) else ""
            normalize_record_first_col(record, headers)
            is_anomaly = False
            for val in record.values():
                str_val = str(val).strip()
                if "?" in str_val:
                    is_anomaly = True
                    break
            table_rows_to_add.append(models.TableRow(table_id=table_id, data=record, is_anomaly=is_anomaly, sort_order=row_arr_idx))
        if table_rows_to_add:
            db.bulk_save_objects(table_rows_to_add)
        db.commit()

        if table.csv_path:
            try:
                csv_path = get_safe_windows_path(table.csv_path)
                os.makedirs(os.path.dirname(csv_path), exist_ok=True)
                with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(headers)
                    writer.writerow(units)
                    writer.writerow(years)
                    for row_arr in payload.rows:
                        writer.writerow(row_arr)
            except (OSError, csv.Error) as e:
                logger.warning(f"Gagal menyimpan file CSV ke disk: {e}")

        log_activity(db, "save_table", table.table_name or f"table_id={table_id}", {"rows": len(payload.rows), "table_id": table_id})
        return {"message": "Data CSV berhasil disimpan"}
    except (SQLAlchemyError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/tables")
def admin_get_tables(db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Mengambil daftar semua tabel untuk panel admin beserta jumlah baris."""
    tables = db.query(
        models.ExtractedTable.id, 
        models.ExtractedTable.table_name, 
        models.ExtractedTable.csv_path,
        models.Document.year,
        models.Document.filename
    ).join(models.Document, models.ExtractedTable.document_id == models.Document.id).all()
    
    counts_query = db.query(models.TableRow.table_id, func.count(models.TableRow.id)).group_by(models.TableRow.table_id).all()
    counts_map = {t_id: count for t_id, count in counts_query}

    result = []
    for t in tables:
        row_count = counts_map.get(t.id, 0)
        table_name_str = t.table_name or ""
        m = re.search(r'Tabel[\s_]*(\d+)', table_name_str, re.IGNORECASE)
        result.append({
            "id": t.id,
            "table_name": table_name_str,
            "csv_path": t.csv_path,
            "year": t.year,
            "db_rows": row_count,
            "document_name": t.filename,
            "bab_num": int(m.group(1)) if m else None,
            "has_db_data": row_count > 0
        })
    return result

@router.post("/admin/clear-loaded-data")
def clear_loaded_data(db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menghapus semua baris data yang telah dimuat ke database."""
    try:
        db.query(models.TableRow).delete()
        db.commit()
        return {"message": "All loaded table rows have been cleared successfully."}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear data: {e!s}")

@router.put("/admin/safe-all")
def mark_all_database_anomalies_safe(db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menandai semua baris anomali di seluruh database sebagai aman."""
    count = db.query(models.TableRow).filter(models.TableRow.is_anomaly == True).count()
    db.query(models.TableRow).filter(models.TableRow.is_anomaly == True).update({"is_anomaly": False})
    db.commit()
    log_activity(db, "safe_all_anomaly", f"{count} baris ditandai aman")
    return {"message": "Semua data anomali di database berhasil ditandai aman."}

@router.get("/admin/all-data-anomalies")
def get_all_data_anomalies(db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Mengambil semua baris yang ditandai sebagai anomali dari seluruh tabel."""
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
        return {"anomalies": results}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================================
# RELOCATED FROM MAIN.PY (MODULAR ARCHITECTURE)
# =====================================================================
@router.post("/tables/{table_id}/load")
def load_table_csv(table_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Memuat data dari file CSV ke database untuk tabel tertentu."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Hapus row yang sudah ada jika re-load
    db.query(models.TableRow).filter(models.TableRow.table_id == table_id).delete()
    
    try:
        safe_path = get_safe_windows_path(table.csv_path)
        headers, records, units, years = parse_csv_for_db(safe_path)
        
        # Simpan metadata kolom langsung ke database
        table.headers = headers
        table.units = units
        table.years = years
        
        anomaly_count = 0
        for row_idx, record in enumerate(records):
            normalize_record_first_col(record, headers)
            is_anomaly = False
            # Deteksi anomali: hanya tandai jika mengandung "?"
            for val in record.values():
                str_val = str(val).strip()
                if "?" in str_val or str_val == "":
                    is_anomaly = True
                    break
            
            if is_anomaly:
                anomaly_count += 1
                
            db_row = models.TableRow(table_id=table.id, data=record, is_anomaly=is_anomaly, sort_order=row_idx)
            db.add(db_row)
        db.commit()
        return {"message": f"Loaded {len(records)} rows successfully. Found {anomaly_count} anomalies."}
    except (SQLAlchemyError, OSError, csv.Error) as e:
        raise HTTPException(status_code=500, detail=f"Error loading CSV: {e!s}")

# ===== PENCARIAN TABEL =====
@router.get("/tables/search")
def search_tables(
    q: str = "",
    year: int | None = None,
    document_id: int | None = None,
    bab: int | None = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Search tables by keyword or numbering. Supports document_id and bab filters."""
    try:
        query = db.query(
            models.ExtractedTable,
            models.Document.year,
            models.Document.filename
        ).join(
            models.Document,
            models.ExtractedTable.document_id == models.Document.id
        )

        if document_id:
            query = query.filter(models.ExtractedTable.document_id == document_id)

        if bab is not None:
            query = query.filter(
                (models.ExtractedTable.table_name.ilike(f"Tabel {bab}.%")) |
                (models.ExtractedTable.table_name.ilike(f"Tabel_{bab}.%")) |
                (models.ExtractedTable.table_name.ilike(f"{bab}.%")) |
                (models.ExtractedTable.table_name.ilike(f"Tabel {bab}-%")) |
                (models.ExtractedTable.table_name.ilike(f"Tabel_{bab}-%"))
            )

        if q:
            kw = q.strip().lower()
            # Clean common prefixes like "tabel " or "tabel_" if user typed it
            kw_clean = re.sub(r'^(tabel[\s_]*)', '', kw)
            
            # If search term is a number/dot pattern, e.g. "2.1.1" or "2"
            if re.match(r'^[\d.]+$', kw_clean):
                query = query.filter(
                    (models.ExtractedTable.table_name.ilike(f"Tabel {kw_clean}%")) |
                    (models.ExtractedTable.table_name.ilike(f"Tabel_{kw_clean}%")) |
                    (models.ExtractedTable.table_name.ilike(f"%{kw_clean}%"))
                )
            else:
                query = query.filter(
                    models.ExtractedTable.table_name.ilike(f"%{kw}%")
                )

        if year:
            query = query.filter(models.Document.year == year)

        results = query.order_by(models.ExtractedTable.id).limit(limit).all()

        tables_out = []
        for t, doc_year, doc_name in results:
            if not t:
                continue
            table_name_str = t.table_name or ""
            # Extract chapter number safely
            m = re.search(r'Tabel[\s_]*(\d+)', table_name_str, re.IGNORECASE)
            bab_num = int(m.group(1)) if m else None
            tables_out.append({
                "id": t.id,
                "table_name": table_name_str,
                "document_id": t.document_id,
                "document_year": doc_year,
                "document_name": doc_name,
                "bab_num": bab_num
            })

        return {"tables": tables_out, "total": len(tables_out)}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database search failed: {e!s}")


@router.get("/tables/{table_id}")
def get_table_info(table_id: int, db: Session = Depends(get_db)):
    """Get table basic info including whether DB data exists."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(404, "Table not found")
    doc = db.query(models.Document).filter(models.Document.id == table.document_id).first()
    has_db = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).first() is not None
    return {
        "id": table.id,
        "table_name": table.table_name or "",
        "csv_path": table.csv_path or "",
        "document_id": table.document_id,
        "document_name": doc.filename if doc else "",
        "document_year": doc.year if doc else None,
        "has_db_data": has_db
    }


@router.put("/tables/{table_id}/db_rows")
def save_db_rows(table_id: int, payload: dict, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Batch update database rows from edit mode."""
    rows = payload.get("rows", [])
    for row_data in rows:
        row_id = row_data.get("id")
        data = sanitize_row_data(row_data.get("data", {}))
        is_anomaly = row_data.get("is_anomaly", False)
        if row_id:
            row = db.query(models.TableRow).filter(models.TableRow.id == row_id, models.TableRow.table_id == table_id).first()
            if row:
                row.data = data
                row.is_anomaly = is_anomaly
    db.commit()
    return {"message": f"{len(rows)} baris tersimpan"}

# Get table data from DB with CSV header metadata (unit, year) for unified rendering
@router.get("/tables/{table_id}/data")
def get_table_data(table_id: int, response: Response, db: Session = Depends(get_db)):
    """Mengambil data lengkap tabel beserta metadata header, unit, tahun, dan tipe kolom."""
    response.headers["Cache-Control"] = "public, s-maxage=120, stale-while-revalidate=300"
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).order_by(models.TableRow.sort_order.asc(), models.TableRow.id.asc()).all()
    
    headers = get_table_headers(db, table)
    units = table.units if table and table.units else ([""] * len(headers) if headers else [])
    years = table.years if table and table.years else ([""] * len(headers) if headers else [])
    
    # Hitung tipe data per kolom (column_types):
    # Kolom 0 selalu text (nama wilayah / label), kolom 1 ke atas default number kecuali kolom keterangan
    column_types = []
    text_indicators = ["kategori", "keterangan", "status", "nama", "uraian", "deskripsi", "jenis", "sektor", "bulan"]
    for idx, h in enumerate(headers):
        if idx == 0:
            column_types.append("text")
        else:
            h_lower = str(h).lower()
            if any(w in h_lower for w in text_indicators) and not any(char.isdigit() for char in h_lower):
                column_types.append("text")
            else:
                column_types.append("number")
            
    return {
        "headers": headers, 
        "units": units,
        "years": years,
        "column_types": column_types,
        "rows": [{"id": r.id, "data": r.data, "is_anomaly": r.is_anomaly} for r in rows]
    }

@router.put("/data/{row_id}")
def update_row_data(row_id: int, payload: dict, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Memperbarui data satu baris berdasarkan ID baris."""
    row = db.query(models.TableRow).filter(models.TableRow.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    row.data = sanitize_row_data(payload.get("data", {}))
    db.commit()
    log_activity(db, "edit_row", f"row_id={row_id}", {"table_id": row.table_id})
    return {"message": "Updated successfully"}

@router.put("/data/{row_id}/safe")
def mark_row_safe(row_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menandai satu baris sebagai aman (bukan anomali)."""
    row = db.query(models.TableRow).filter(models.TableRow.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    row.is_anomaly = False
    db.commit()
    return {"message": "Row marked as safe"}

@router.put("/tables/{table_id}/safe-all")
def mark_all_rows_safe(table_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menandai semua baris pada tabel tertentu sebagai aman."""
    db.query(models.TableRow).filter(models.TableRow.table_id == table_id).update({"is_anomaly": False})
    db.commit()
    log_activity(db, "safe_anomaly", f"table_id={table_id}")
    return {"message": "All rows marked as safe"}

@router.delete("/data/{row_id}")
def delete_row(row_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Menghapus satu baris dari database berdasarkan ID."""
    row = db.query(models.TableRow).filter(models.TableRow.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    table_id = row.table_id
    db.delete(row)
    db.commit()
    log_activity(db, "delete_row", f"row_id={row_id}", {"table_id": table_id})
    return {"message": "Deleted successfully"}

def get_clean_chapter_name(level1: str) -> str:
    """Mengambil nama bab bersih dari nomor bab level 1."""
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
    """Membersihkan nama tabel dari prefix, referensi halaman, dan tahun."""
    if not table_name:
        return ""
    # 1. Hapus awalan nomor tabel (contoh: "Tabel 4.4.2 - " atau "Tabel 4.4.2 ")
    name = re.sub(r'^(?:Tabel[\s_]*\d+(?:\.\d+)*\s*(?:-\s*|:\s*|)\s*)', '', table_name, flags=re.IGNORECASE)
    # 2. Hapus .csv di akhir jika ada
    name = re.sub(r'\.csv$', '', name, flags=re.IGNORECASE)
    # 3. Hapus referensi halaman seperti (Hal 46), (Hal 47, 48), (Halaman 12), dll.
    name = re.sub(r'\s*\((?:Hal|Halaman|hlm)[\s\d,\-–—\.\?]+\)', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\(\s*\d+[\s,\d\-–—\.]*\)\s*$', '', name)
    # 4. Hapus 'Tahun 2022', 'Pada Tahun 2021-2022', 'Year 2025' atau sisa 'Tahun' di ujung akhir
    year_token = r'(?:19|20)\d{2}[*\d]?'
    year_conn = r'(?:\s*(?:[-–—/]|dan|and|sd|s/d|to|,)\s*' + year_token + r')*'
    name = re.sub(r'[,.\s]+(?:(?:pada|di)\s+)?(?:tahun|years?)\s*(?:' + year_token + year_conn + r'.*)?$', '', name, flags=re.IGNORECASE)
    # 5. Hapus tahun langsung jika tanpa kata 'tahun', misal ', 2022' atau ' 2021-2025'
    name = re.sub(r'[,.\s]+' + year_token + year_conn + r'.*$', '', name, flags=re.IGNORECASE)
    # 6. Hapus sisa kata 'Tahun' / 'Year' jika masih ada di ujung akhir
    name = re.sub(r'[,.\s]+(?:(?:pada|di)\s+)?(?:tahun|years?)\s*$', '', name, flags=re.IGNORECASE)
    return re.sub(r'[,.\-\s–—]+$', '', name).strip()


@router.get("/tables/{table_id}/neighbors")
def get_table_neighbors(table_id: int, db: Session = Depends(get_db)):
    """Get next and previous table IDs within the same document."""
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(404, "Table not found")
    
    siblings = db.query(models.ExtractedTable).filter(
        models.ExtractedTable.document_id == table.document_id
    ).all()
    
    def natural_sort_key(t):
        name = t.table_name or ""
        match = re.search(r'(\d+(?:\.\d+)+)', name)
        if match:
            try:
                parts = [int(p) for p in match.group(1).split('.')]
                return (0, parts, name.lower())
            except ValueError:
                pass
        return (1, [], name.lower())
        
    siblings.sort(key=natural_sort_key)
    
    prev_id = None
    next_id = None
    curr_idx = -1
    for i, s in enumerate(siblings):
        if s.id == table_id:
            curr_idx = i
            if i > 0:
                prev_id = siblings[i - 1].id
            if i < len(siblings) - 1:
                next_id = siblings[i + 1].id
            break
    
    return {
        "prev_id": prev_id,
        "next_id": next_id,
        "prev_name": siblings[curr_idx - 1].table_name if curr_idx > 0 else None,
        "next_name": siblings[curr_idx + 1].table_name if curr_idx < len(siblings) - 1 else None,
        "current_index": curr_idx,
        "total_in_doc": len(siblings)
    }

