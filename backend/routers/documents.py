import os
import io
import re
import csv
import json
import zipfile
import subprocess
from datetime import datetime
from typing import List
from pydantic import BaseModel
import openpyxl
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
from database import get_db
from pipeline import get_toc
from routers.auth import log_activity

router = APIRouter(prefix="/api", tags=["Documents & Excel Import"])

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_BPS_DATA_ROOT = os.path.join(os.path.expanduser("~"), "BPS_Data")
UPLOAD_DIR = os.path.join(_BPS_DATA_ROOT, "uploads")
EXTRACT_DIR = os.path.join(_BPS_DATA_ROOT, "hasil_ekstraksi_web")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXTRACT_DIR, exist_ok=True)

class ExtractRequest(BaseModel):
    start_page: int
    end_page: int

class TOCItem(BaseModel):
    title: str
    start_page: int
    end_page: int

def get_safe_windows_path(path: str) -> str:
    if not path:
        return path
    abs_p = os.path.abspath(path)
    if abs_p.startswith('\\\\?\\'):
        return abs_p
    if len(abs_p) >= 250 and os.name == 'nt':
        return '\\\\?\\' + abs_p
    return abs_p

def sanitize_template_filename(table_name: str) -> str:
    if not table_name:
        return "template.xlsx"
    clean_name = str(table_name).strip()
    m = re.search(r'\(Hal[_\s]+([\d,_\s]+)\)', clean_name, re.IGNORECASE)
    if m:
        pages = re.findall(r'\d+', m.group(1))
        if len(pages) > 2:
            first_p = pages[0]
            last_p = pages[-1]
            new_hal = f"(Hal_{first_p}-{last_p})"
            clean_name = clean_name[:m.start()] + new_hal + clean_name[m.end():]
    clean_name = clean_name.replace(' ', '_').replace('/', '-').replace(':', '-').replace('*', '').replace('?', '').replace('"', '').replace('<', '').replace('>', '').replace('|', '')
    if len(clean_name) > 120:
        clean_name = clean_name[:120].rstrip('_- ')
    return f"{clean_name}.xlsx"

def run_extract_toc(doc_id: int, file_path: str, output_path: str):
    db = next(get_db())
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        return
    os.makedirs(output_path, exist_ok=True)
    try:
        import sys
        script_path = os.path.abspath(os.path.join(_BASE_DIR, "..", "pipeline", "extract_toc.py"))
        cmd = [
            sys.executable, script_path,
            "--pdf", os.path.abspath(file_path),
            "--output_dir", os.path.abspath(output_path)
        ]
        subprocess.run(cmd)
    except Exception as e:
        print(f"Gagal ekstraksi TOC: {str(e)}")

def run_extraction(doc_id: int, file_path: str, output_path: str, start_page: int, end_page: int):
    db = next(get_db())
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        return
    doc.status = f"extracting hal {start_page}-{end_page}"
    db.commit()
    try:
        import sys
        script_path = os.path.abspath(os.path.join(_BASE_DIR, "..", "pipeline", "pdf_table_pipeline.py"))
        cmd = [
            sys.executable, script_path, 
            "--pdf", os.path.abspath(file_path), 
            "--output_dir", os.path.abspath(output_path),
            "--start_page", str(start_page),
            "--end_page", str(end_page)
        ]
        mods_path = os.path.abspath(os.path.join(_BASE_DIR, "..", "table_mods.json"))
        if os.path.exists(mods_path):
            cmd.extend(["--modifications", mods_path])
        import copy
        env = copy.deepcopy(os.environ)
        env["OPENBLAS_NUM_THREADS"] = "1"
        env["OMP_NUM_THREADS"] = "1"
        env["MKL_NUM_THREADS"] = "1"
        env["NUMEXPR_NUM_THREADS"] = "1"
        result = subprocess.run(cmd, capture_output=True, text=True, env=env)
        if result.returncode != 0:
            error_msg = result.stderr[-450:] if len(result.stderr) > 450 else result.stderr
            doc.status = f"error: exit {result.returncode}. Log: ...{error_msg}"
            db.commit()
            return
        doc.status = "ready"
        db.commit()
    except Exception as e:
        doc.status = f"error: {str(e)}"
        db.commit()

@router.post("/documents", response_model=schemas.DocumentOut)
async def upload_document(
    background_tasks: BackgroundTasks,
    year: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    db_doc = models.Document(filename=file.filename, year=year, status="ready")
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    
    output_path = os.path.join(EXTRACT_DIR, f"doc_{db_doc.id}")
    background_tasks.add_task(run_extract_toc, db_doc.id, file_path, output_path)
    log_activity(db, "upload", file.filename, {"year": year, "doc_id": db_doc.id})
    return db_doc

@router.post("/documents/create", response_model=schemas.DocumentOut)
def create_manual_document(doc_in: schemas.DocumentCreate, db: Session = Depends(get_db)):
    clean_filename = (doc_in.filename or "").strip()
    if not clean_filename:
        raise HTTPException(status_code=400, detail="Nama publikasi wajib diisi.")
    if not doc_in.year or doc_in.year < 1900 or doc_in.year > 2100:
        raise HTTPException(status_code=400, detail="Tahun publikasi tidak valid (1900 - 2100).")

    existing = db.query(models.Document).filter(
        models.Document.filename == clean_filename,
        models.Document.year == doc_in.year
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Publikasi '{clean_filename}' ({doc_in.year}) sudah terdaftar.")

    db_doc = models.Document(filename=clean_filename, year=doc_in.year, status="ready")
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    doc_dir = os.path.join(EXTRACT_DIR, f"doc_{db_doc.id}")
    os.makedirs(doc_dir, exist_ok=True)
    return db_doc

@router.get("/documents", response_model=List[schemas.DocumentOut])
def get_documents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    results = (
        db.query(
            models.Document,
            func.count(models.ExtractedTable.id).label("table_count")
        )
        .outerjoin(models.ExtractedTable, models.Document.id == models.ExtractedTable.document_id)
        .group_by(models.Document.id)
        .order_by(models.Document.year.desc(), models.Document.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    docs_out = []
    for doc, count in results:
        docs_out.append({
            "id": doc.id,
            "filename": doc.filename,
            "year": doc.year,
            "status": doc.status,
            "created_at": doc.created_at,
            "table_count": count
        })
    return docs_out

@router.get("/documents/{doc_id}/toc")
def get_document_toc(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc_dir = os.path.join(EXTRACT_DIR, f"doc_{doc_id}")
    os.makedirs(doc_dir, exist_ok=True)
    toc_path = os.path.join(doc_dir, "toc.json")
    if os.path.exists(toc_path):
        try:
            with open(toc_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data and len(data) > 0:
                    return data
        except Exception:
            pass
            
    tables = db.query(models.ExtractedTable).filter(models.ExtractedTable.document_id == doc_id).all()
    babs = set()
    for t in tables:
        m = re.match(r'Tabel[\s_]*(\d+)', t.table_name or '')
        if m:
            babs.add(int(m.group(1)))
            
    if babs:
        bps_names = {
            1: "Geografi dan Iklim",
            2: "Pemerintahan",
            3: "Penduduk dan Ketenagakerjaan",
            4: "Sosial dan Kesejahteraan Rakyat",
            5: "Pertanian, Kehutanan, Peternakan, dan Perikanan",
            6: "Industri, Pertambangan, dan Energi",
            7: "Perdagangan",
            8: "Hotel dan Pariwisata",
            9: "Transportasi dan Komunikasi",
            10: "Keuangan Daerah dan Harga",
            11: "Pengeluaran Penduduk",
            12: "Pendapatan Regional"
        }
        auto_toc = []
        for b in sorted(babs):
            b_name = bps_names.get(b, f"Bab {b}")
            auto_toc.append({
                "title": f"Bab {b} - {b_name}",
                "start_page": b,
                "end_page": b
            })
        try:
            with open(toc_path, "w", encoding="utf-8") as f:
                json.dump(auto_toc, f, indent=4)
        except Exception:
            pass
        return auto_toc

    return []

@router.post("/documents/{doc_id}/detect_toc")
def detect_document_toc(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    output_path = os.path.join(EXTRACT_DIR, f"doc_{doc.id}")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="File PDF tidak ditemukan di server.")
        
    try:
        os.makedirs(output_path, exist_ok=True)
        toc_data = get_toc(file_path)
        toc_path = os.path.join(output_path, "toc.json")
        with open(toc_path, "w", encoding="utf-8") as f:
            json.dump(toc_data, f, indent=4)
        return {"status": "success", "message": f"Deteksi Bab selesai. Menemukan {len(toc_data)} bab.", "data": toc_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal melakukan deteksi bab: {str(e)}")

@router.post("/documents/{doc_id}/toc")
def save_document_toc(doc_id: int, toc_data: List[TOCItem], db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc_dir = os.path.join(EXTRACT_DIR, f"doc_{doc_id}")
    os.makedirs(doc_dir, exist_ok=True)
    toc_path = os.path.join(doc_dir, "toc.json")
    try:
        dict_data = [item.dict() for item in toc_data]
        with open(toc_path, "w", encoding="utf-8") as f:
            json.dump(dict_data, f, indent=4)
        return {"status": "success", "message": "TOC updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save TOC: {str(e)}")

@router.delete("/documents/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    from routers.admin import backup_database
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        backup_database()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Penghapusan dibatalkan: backup otomatis gagal ({str(e)})")
        
    file_path = get_safe_windows_path(os.path.join(UPLOAD_DIR, doc.filename))
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass
        
    output_path = os.path.join(EXTRACT_DIR, f"doc_{doc.id}")
    safe_output_path = get_safe_windows_path(output_path)
    if os.path.exists(safe_output_path):
        import shutil, stat
        def remove_readonly(func, path, excinfo):
            try:
                os.chmod(path, stat.S_IWRITE)
                func(path)
            except Exception:
                pass
        try:
            shutil.rmtree(safe_output_path, onerror=remove_readonly)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gagal menghapus folder hasil ekstraksi: {str(e)}")
        
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}

@router.post("/documents/{doc_id}/extract")
def extract_document(doc_id: int, req: ExtractRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    output_path = os.path.join(EXTRACT_DIR, f"doc_{doc.id}")
    background_tasks.add_task(run_extraction, doc.id, file_path, output_path, req.start_page, req.end_page)
    return {"message": "Extraction started in background"}

@router.get("/documents/{doc_id}/tables", response_model=List[schemas.ExtractedTableOut])
def get_document_tables(doc_id: int, db: Session = Depends(get_db)):
    tables = db.query(models.ExtractedTable).filter(models.ExtractedTable.document_id == doc_id).all()
    table_ids = [t.id for t in tables]
    if table_ids:
        loaded_table_ids = set(
            r[0] for r in db.query(models.TableRow.table_id)
            .filter(models.TableRow.table_id.in_(table_ids))
            .distinct().all()
        )
    else:
        loaded_table_ids = set()
    for t in tables:
        t.has_db_data = t.id in loaded_table_ids
    return tables
