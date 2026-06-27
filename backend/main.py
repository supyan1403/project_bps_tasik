import csv
import os
import re
import subprocess
import sys
import pandas as pd
from typing import List, Dict, Any, Union
from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import models
import schemas
from database import engine, get_db
from fastapi.responses import FileResponse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from pdf_table_pipeline import detect_and_clean_metadata, deduplicate_columns, ENGLISH_ONLY_WORDS, INDO_SAFE_WORDS

def clean_bilingual_header(header: str) -> str:
    """
    Bersihkan nama kolom bilingual duplikat, contoh:
    "Irigasi Irrigation"           -> "Irigasi"
    "Non Irigasi Non Irrigation"   -> "Non Irigasi"
    "Lahan Sawah Paddy Field"      -> "Lahan Sawah"
    
    Strategi:
    1. Hapus kata-kata bahasa Inggris dari belakang.
    2. Hapus kata-kata trailing yang sudah muncul di bagian awal (duplikat parsial).
    3. Hapus konsekutif duplikat kata (misal "Sawah Sawah" -> "Sawah").
    """
    if not header:
        return header

    words = header.strip().split()
    if len(words) <= 1:
        return header

    # Langkah 1: Hapus kata Inggris dari belakang
    while words:
        last_clean = re.sub(r'[^a-z]', '', words[-1].lower())
        if last_clean in ENGLISH_ONLY_WORDS and last_clean not in INDO_SAFE_WORDS:
            words.pop()
        else:
            break

    # Langkah 2: Hapus kata trailing yang sudah ada di bagian awal (menangani "Non Irigasi Non")
    # Cek apakah kata terakhir sudah muncul sebelumnya di kata-kata sebelumnya
    while len(words) > 1:
        last_word_lower = words[-1].lower()
        # Cek apakah kata terakhir juga ada di bagian sebelumnya
        if last_word_lower in [w.lower() for w in words[:-1]]:
            words.pop()
        else:
            break

    # Langkah 3: Hapus kata duplikat berturut-turut (misal "Sawah Sawah" -> "Sawah")
    deduped = []
    for w in words:
        if not deduped or w.lower() != deduped[-1].lower():
            deduped.append(w)

    result = " ".join(deduped).strip()
    return result if result else header



def get_safe_windows_path(path: str) -> str:
    if os.name == 'nt':
        abs_path = os.path.abspath(path)
        if not abs_path.startswith("\\\\?\\"):
            return "\\\\?\\" + abs_path.replace("/", "\\")
    return path


models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="BPS Extraction Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

UPLOAD_DIR = "../uploads"
EXTRACT_DIR = "../hasil_ekstraksi_web"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXTRACT_DIR, exist_ok=True)

@app.get("/")
def read_root(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={})

@app.get("/api/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_docs = db.query(models.Document).count()
    total_tables = db.query(models.ExtractedTable).count()
    total_rows = db.query(models.TableRow).count()
    total_anomalies = db.query(models.TableRow).filter(models.TableRow.is_anomaly == True).count()
    
    return {
        "total_docs": total_docs,
        "total_tables": total_tables,
        "total_rows": total_rows,
        "total_anomalies": total_anomalies
    }

def run_extract_toc(doc_id: int, file_path: str, output_path: str):
    db = next(get_db())
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        return
        
    os.makedirs(output_path, exist_ok=True)
    
    try:
        import sys
        script_path = os.path.abspath("../extract_toc.py")
        
        cmd = [
            sys.executable, script_path,
            "--pdf", os.path.abspath(file_path),
            "--output_dir", os.path.abspath(output_path)
        ]
        
        import subprocess
        subprocess.run(cmd)
    except Exception as e:
        print(f"Gagal ekstraksi TOC: {str(e)}")

@app.post("/api/documents", response_model=schemas.DocumentOut)
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
    
    # Run extract_toc in background
    output_path = os.path.join(EXTRACT_DIR, f"doc_{db_doc.id}")
    background_tasks.add_task(run_extract_toc, db_doc.id, file_path, output_path)
    
    return db_doc

@app.get("/api/documents/{doc_id}/suggest_pages")
def suggest_pages(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    toc_path = os.path.join(EXTRACT_DIR, f"doc_{doc.id}", "toc.json")
    safe_path = get_safe_windows_path(toc_path)
    
    if not os.path.exists(safe_path):
        # Fallback default untuk Kabupaten Tasikmalaya Dalam Angka
        return [
            {"title": "Bab 1 - Geografi dan Iklim", "start_page": 42, "end_page": 54},
            {"title": "Bab 2 - Pemerintahan", "start_page": 54, "end_page": 75},
            {"title": "Bab 3 - Kependudukan", "start_page": 75, "end_page": 93},
            {"title": "Bab 4 - Ketenagakerjaan", "start_page": 93, "end_page": 179},
            {"title": "Bab 5 - Sosial dan Kesejahteraan Rakyat", "start_page": 179, "end_page": 288},
            {"title": "Bab 6 - Pertanian", "start_page": 288, "end_page": 310},
            {"title": "Bab 7 - Industri, Pertambangan, Energi, dan Konstruksi", "start_page": 310, "end_page": 325},
            {"title": "Bab 8 - Pariwisata, Transportasi, dan Komunikasi", "start_page": 325, "end_page": 336},
            {"title": "Bab 9 - Perbankan, Koperasi, dan Perdagangan", "start_page": 336, "end_page": 348},
            {"title": "Bab 10 - Pengeluaran Penduduk", "start_page": 348, "end_page": 356},
            {"title": "Bab 11 - Pendapatan Regional", "start_page": 356, "end_page": 368}
        ]
        
    try:
        with open(safe_path, 'r', encoding='utf-8') as f:
            import json
            return json.load(f)
    except Exception as e:
        # Fallback default jika terjadi error load file
        return [
            {"title": "Bab 1 - Geografi dan Iklim", "start_page": 42, "end_page": 54},
            {"title": "Bab 2 - Pemerintahan", "start_page": 54, "end_page": 75},
            {"title": "Bab 3 - Kependudukan", "start_page": 75, "end_page": 93},
            {"title": "Bab 4 - Ketenagakerjaan", "start_page": 93, "end_page": 179},
            {"title": "Bab 5 - Sosial dan Kesejahteraan Rakyat", "start_page": 179, "end_page": 288},
            {"title": "Bab 6 - Pertanian", "start_page": 288, "end_page": 310},
            {"title": "Bab 7 - Industri, Pertambangan, Energi, dan Konstruksi", "start_page": 310, "end_page": 325},
            {"title": "Bab 8 - Pariwisata, Transportasi, dan Komunikasi", "start_page": 325, "end_page": 336},
            {"title": "Bab 9 - Perbankan, Koperasi, dan Perdagangan", "start_page": 336, "end_page": 348},
            {"title": "Bab 10 - Pengeluaran Penduduk", "start_page": 348, "end_page": 356},
            {"title": "Bab 11 - Pendapatan Regional", "start_page": 356, "end_page": 368}
        ]


@app.get("/api/documents", response_model=List[schemas.DocumentOut])
def get_documents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Document).offset(skip).limit(limit).all()

@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    file_path = get_safe_windows_path(os.path.join(UPLOAD_DIR, doc.filename))
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass
        
    # Hapus folder hasil ekstraksinya juga agar tidak ada file sisa/duplikat
    output_path = os.path.join(EXTRACT_DIR, f"doc_{doc.id}")
    safe_output_path = get_safe_windows_path(output_path)
    
    if os.path.exists(safe_output_path):
        import shutil
        import stat
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


from pydantic import BaseModel

class ExtractRequest(BaseModel):
    start_page: int
    end_page: int

def run_extraction(doc_id: int, file_path: str, output_path: str, start_page: int, end_page: int):
    db = next(get_db())
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        return
    
    doc.status = f"extracting hal {start_page}-{end_page}"
    db.commit()
    
    try:
        # Panggil pipeline script menggunakan sys.executable (venv python)
        import sys
        script_path = os.path.abspath("../pdf_table_pipeline.py")
        
        cmd = [
            sys.executable, script_path, 
            "--pdf", os.path.abspath(file_path), 
            "--output_dir", os.path.abspath(output_path),
            "--start_page", str(start_page),
            "--end_page", str(end_page)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            error_msg = result.stderr[-450:] if len(result.stderr) > 450 else result.stderr
            doc.status = f"error: exit {result.returncode}. Log: ...{error_msg}"
            db.commit()
            return
            
        doc.status = "ready" # Kembali ready agar bisa diekstrak lagi bab lainnya
        
        # Cari file CSV HANYA di folder hasil ekstraksi yang baru saja berjalan!
        # Ini mencegah duplikasi jika user melakukan ekstraksi berkali-kali pada dokumen yang sama
        specific_output_dir = os.path.join(output_path, f"Ekstraksi_Hal_{start_page}_sd_{end_page}")
        
        if os.path.exists(specific_output_dir):
            for root, _, files in os.walk(specific_output_dir):
                for file in files:
                    if file.endswith(".csv"):
                        csv_full_path = os.path.join(root, file)
                        table_name = file.replace(".csv", "").replace(" __SLASH__ ", "/").replace("__SLASH__", "/")
                        
                        # Cek apakah tabel ini sudah pernah diekstrak (timpa jika ya)
                        existing_table = db.query(models.ExtractedTable).filter_by(document_id=doc.id, table_name=table_name).first()
                        if not existing_table:
                            db_table = models.ExtractedTable(document_id=doc.id, table_name=table_name, csv_path=csv_full_path)
                            db.add(db_table)
                        else:
                            existing_table.csv_path = csv_full_path
                            db.commit()
        db.commit()
    except Exception as e:
        doc.status = f"error: {str(e)}"
        db.commit()

@app.post("/api/documents/{doc_id}/extract")
def extract_document(doc_id: int, req: ExtractRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    output_path = os.path.join(EXTRACT_DIR, f"doc_{doc.id}")
    
    background_tasks.add_task(run_extraction, doc.id, file_path, output_path, req.start_page, req.end_page)
    return {"message": "Extraction started in background"}

@app.get("/api/documents/{doc_id}/tables", response_model=List[schemas.ExtractedTableOut])
def get_document_tables(doc_id: int, db: Session = Depends(get_db)):
    tables = db.query(models.ExtractedTable).filter(models.ExtractedTable.document_id == doc_id).all()
    return tables

@app.delete("/api/tables/{table_id}")
def delete_table(table_id: int, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
        
    if table.csv_path:
        safe_path = get_safe_windows_path(table.csv_path)
        if os.path.exists(safe_path):
            try:
                os.remove(safe_path)
            except Exception:
                pass
        
    db.delete(table)
    db.commit()
    return {"message": "Table deleted successfully"}

@app.delete("/api/documents/{doc_id}/bab/{bab_num}")
def delete_bab(doc_id: int, bab_num: int, db: Session = Depends(get_db)):
    tables = db.query(models.ExtractedTable).filter(models.ExtractedTable.document_id == doc_id).all()
    deleted_count = 0
    import re
    
    for table in tables:
        # Cari nomor tabel, misalnya "Tabel 1.1.1" atau "Tabel_1.1.2"
        match = re.search(r'Tabel[\s_]*(\d+)', table.table_name, re.IGNORECASE)
        if match and int(match.group(1)) == bab_num:
            if table.csv_path:
                safe_path = get_safe_windows_path(table.csv_path)
                if os.path.exists(safe_path):
                    try:
                        os.remove(safe_path)
                    except:
                        pass
            db.delete(table)
            deleted_count += 1
            
    if deleted_count > 0:
        db.commit()
        
    return {"message": f"{deleted_count} tabel pada Bab {bab_num} berhasil dihapus"}


def parse_csv_for_db(safe_path: str) -> tuple:
    raw_rows = []
    with open(safe_path, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f)
        for row in reader:
            raw_rows.append(row)
            
    if not raw_rows:
        return [], []
        
    headers = raw_rows[0]
    has_metadata = False
    if len(raw_rows) >= 3:
        col0_row1 = str(raw_rows[1][0]).strip().lower() if len(raw_rows[1]) > 0 else ""
        col0_row2 = str(raw_rows[2][0]).strip().lower() if len(raw_rows[2]) > 0 else ""
        if col0_row1 == "satuan" or col0_row2 == "tahun":
            has_metadata = True
            
    if has_metadata:
        data_rows = raw_rows[3:]
    else:
        data_rows = raw_rows[1:]
        
    records = []
    for r in data_rows:
        record = {}
        for idx, h in enumerate(headers):
            val = r[idx] if idx < len(r) else ""
            record[h] = val
        records.append(record)
        
    return headers, records

@app.post("/api/tables/{table_id}/load")
def load_table_csv(table_id: int, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Hapus row yang sudah ada jika re-load
    db.query(models.TableRow).filter(models.TableRow.table_id == table_id).delete()
    
    try:
        safe_path = get_safe_windows_path(table.csv_path)
        headers, records = parse_csv_for_db(safe_path)
        
        anomaly_count = 0
        for record in records:
            is_anomaly = False
            # Deteksi anomali: cek apakah ada sel kosong, "-", "?", atau karakter aneh "" (unicode replacement)
            for key, val in record.items():
                str_val = str(val).strip()
                if str_val in ["", "-", "?", ""]:
                    is_anomaly = True
                    break
            
            if is_anomaly:
                anomaly_count += 1
                
            db_row = models.TableRow(table_id=table.id, data=record, is_anomaly=is_anomaly)
            db.add(db_row)
        db.commit()
        return {"message": f"Loaded {len(records)} rows successfully. Found {anomaly_count} anomalies."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading CSV: {str(e)}")

@app.get("/api/tables/{table_id}/data")
def get_table_data(table_id: int, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).order_by(models.TableRow.id.asc()).all()
    
    headers = []
    if table and table.csv_path:
        safe_path = get_safe_windows_path(table.csv_path)
        if os.path.exists(safe_path):
            import pandas as pd
            try:
                df = pd.read_csv(safe_path, nrows=0)
                headers = list(df.columns)
            except Exception:
                pass
            
    return {"headers": headers, "rows": [{"id": r.id, "data": r.data, "is_anomaly": r.is_anomaly} for r in rows]}

@app.put("/api/data/{row_id}")
def update_row_data(row_id: int, payload: dict, db: Session = Depends(get_db)):
    row = db.query(models.TableRow).filter(models.TableRow.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    row.data = payload.get("data", {})
    db.commit()
    return {"message": "Updated successfully"}

@app.delete("/api/data/{row_id}")
def delete_row(row_id: int, db: Session = Depends(get_db)):
    row = db.query(models.TableRow).filter(models.TableRow.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    db.delete(row)
    db.commit()
    return {"message": "Deleted successfully"}

@app.get("/api/tables/{table_id}/csv")
def download_table_csv(table_id: int, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table or not table.csv_path:
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan")
    safe_path = get_safe_windows_path(table.csv_path)
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan di disk")
    return FileResponse(path=safe_path, media_type='text/csv', filename=f"{table.table_name}.csv")

@app.get("/api/tables/{table_id}/csv_preview")
def preview_table_csv(table_id: int, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table or not table.csv_path:
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan")
    safe_path = get_safe_windows_path(table.csv_path)
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan di disk")
    
    try:
        raw_rows = []
        with open(safe_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            for row in reader:
                raw_rows.append(row)
        
        headers = []
        units = []
        years = []
        data_rows = []

        if len(raw_rows) > 0:
            headers = raw_rows[0]
            
            has_metadata = False
            if len(raw_rows) >= 3:
                col0_row1 = str(raw_rows[1][0]).strip().lower() if len(raw_rows[1]) > 0 else ""
                col0_row2 = str(raw_rows[2][0]).strip().lower() if len(raw_rows[2]) > 0 else ""
                if col0_row1 == "satuan" or col0_row2 == "tahun":
                    has_metadata = True
            
            if has_metadata:
                units = raw_rows[1]
                years = raw_rows[2]
                data_rows = raw_rows[3:]
                
                # Normalize units mapping "Persen" to "%"
                for idx in range(len(units)):
                    if units[idx].lower() in ["persen", "persentase", "percent"]:
                        units[idx] = "%"
                
                # Bersihkan nama kolom bilingual (misal "Irigasi Irrigation" -> "Irigasi")
                headers = [clean_bilingual_header(h) for h in headers]
            else:
                doc_year = 2026
                if table.document:
                    doc_year = table.document.year
                headers, units, years = detect_and_clean_metadata(table.table_name, doc_year, headers)
                data_rows = raw_rows[1:]
                
        return {
            "headers": headers, 
            "units": units, 
            "years": years, 
            "rows": data_rows
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CSVRowUpdate(BaseModel):
    data: List[str]

@app.put("/api/tables/{table_id}/csv/row/{row_index}")
def update_csv_row(table_id: int, row_index: int, payload: CSVRowUpdate, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table or not table.csv_path:
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan")
    safe_path = get_safe_windows_path(table.csv_path)
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan di disk")
    
    try:
        with open(safe_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        actual_index = row_index + 1
        if actual_index < len(rows):
            rows[actual_index] = payload.data
            with open(safe_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            return {"message": "Row updated successfully"}
        else:
            raise HTTPException(status_code=400, detail="Row index out of range")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/tables/{table_id}/csv/row/{row_index}")
def delete_csv_row(table_id: int, row_index: int, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table or not table.csv_path:
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan")
    safe_path = get_safe_windows_path(table.csv_path)
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan di disk")
    
    try:
        with open(safe_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        actual_index = row_index + 1
        if actual_index < len(rows):
            del rows[actual_index]
            with open(safe_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            return {"message": "Row deleted successfully"}
        else:
            raise HTTPException(status_code=400, detail="Row index out of range")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tables/{table_id}/csv/insert_row/{row_index}")
def insert_csv_row(table_id: int, row_index: int, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table or not table.csv_path:
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan")
    safe_path = get_safe_windows_path(table.csv_path)
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan di disk")
    
    try:
        with open(safe_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        num_cols = len(rows[0]) if rows else 1
        new_row = [""] * num_cols
        
        # +1 because row_index is 0-based for data rows, but file has header
        actual_index = row_index + 1
        
        if actual_index > len(rows):
            rows.append(new_row)
        else:
            rows.insert(actual_index, new_row)
        
        with open(safe_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            
        return {"message": "Row inserted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tables/{table_id}/csv/row")
def add_csv_row(table_id: int, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table or not table.csv_path:
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan")
    safe_path = get_safe_windows_path(table.csv_path)
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan di disk")
    
    try:
        with open(safe_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        num_cols = len(rows[0]) if rows else 1
        new_row = [""] * num_cols
        rows.append(new_row)
        
        with open(safe_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            
        return {"message": "Row added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CSVColumnAdd(BaseModel):
    column_name: str
    position: Any = "end"  # "start", "end", int index, {"after_column": "nama"}, {"before_column": "nama"}

@app.post("/api/tables/{table_id}/csv/column")
def add_csv_column(table_id: int, payload: CSVColumnAdd, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table or not table.csv_path:
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan")
    safe_path = get_safe_windows_path(table.csv_path)
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan di disk")
    
    try:
        with open(safe_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        if not rows:
            rows.append([payload.column_name])
        else:
            headers = rows[0]
            num_cols = len(headers)
            
            # Resolve insert position
            pos_config = payload.position
            insert_idx = num_cols  # default: end
            
            if pos_config == "start":
                insert_idx = 0
            elif pos_config == "end":
                insert_idx = num_cols
            elif isinstance(pos_config, int):
                insert_idx = max(0, min(pos_config, num_cols))
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
            
            # Insert the new column header and empty values at the resolved position
            for i, row in enumerate(rows):
                value = payload.column_name if i == 0 else ""
                # Pad the row if shorter than expected
                while len(row) < num_cols:
                    row.append("")
                row.insert(insert_idx, value)
            
        with open(safe_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            
        return {"message": "Column added successfully", "insert_index": insert_idx}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/tables/{table_id}/csv/column/{col_index}")
def delete_csv_column(table_id: int, col_index: int, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table or not table.csv_path:
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan")
    safe_path = get_safe_windows_path(table.csv_path)
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan di disk")
    
    try:
        with open(safe_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            rows = list(reader)
            
        if rows and len(rows[0]) > col_index:
            for row in rows:
                if len(row) > col_index:
                    del row[col_index]
                    
            with open(safe_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            return {"message": "Column deleted successfully"}
        else:
            raise HTTPException(status_code=400, detail="Column index out of range")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Rename Table ───────────────────────────────────────────────────────────
class TableRenamePayload(BaseModel):
    new_name: str

@app.put("/api/tables/{table_id}/rename")
def rename_table(table_id: int, payload: TableRenamePayload, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    table.table_name = payload.new_name.strip()
    db.commit()
    return {"message": "Table renamed successfully", "new_name": table.table_name}

# ─── Rename Column in CSV ────────────────────────────────────────────────────
class ColumnRenamePayload(BaseModel):
    col_index: int
    new_name: str

@app.put("/api/tables/{table_id}/csv/rename_column")
def rename_csv_column(table_id: int, payload: ColumnRenamePayload, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table or not table.csv_path:
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan")
    safe_path = get_safe_windows_path(table.csv_path)
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan di disk")
    try:
        with open(safe_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            rows = list(reader)
        if not rows or payload.col_index >= len(rows[0]):
            raise HTTPException(status_code=400, detail="Index kolom di luar batas")
        old_name = rows[0][payload.col_index]
        rows[0][payload.col_index] = payload.new_name.strip()
        with open(safe_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        return {"message": "Column renamed", "old_name": old_name, "new_name": payload.new_name.strip()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CSVSavePayload(BaseModel):
    headers: List[str]
    units: List[str]
    years: List[str]
    rows: List[List[str]]

@app.put("/api/tables/{table_id}/csv/save")
def save_table_csv_all(table_id: int, payload: CSVSavePayload, db: Session = Depends(get_db)):
    table = db.query(models.ExtractedTable).filter(models.ExtractedTable.id == table_id).first()
    if not table or not table.csv_path:
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan")
    safe_path = get_safe_windows_path(table.csv_path)
    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="File CSV tidak ditemukan di disk")
    
    try:
        # Force first elements to be "satuan" and "tahun"
        if len(payload.units) > 0:
            payload.units[0] = "satuan"
        if len(payload.years) > 0:
            payload.years[0] = "tahun"
            
        # Normalize units and deduplicate headers
        for idx in range(len(payload.units)):
            if payload.units[idx].lower() in ["persen", "persentase", "percent"]:
                payload.units[idx] = "%"
        payload.headers = deduplicate_columns(payload.headers)
            
        # Tulis headers + units + years + rows ke file CSV
        all_data = [payload.headers, payload.units, payload.years] + payload.rows
        with open(safe_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(all_data)
        
        # Sync dengan DB jika table ini sudah pernah di-load ke database
        db_has_rows = db.query(models.TableRow).filter(models.TableRow.table_id == table_id).first()
        if db_has_rows:
            # Re-load data ke TableRow DB agar tersinkronisasi
            db.query(models.TableRow).filter(models.TableRow.table_id == table_id).delete()
            headers, records = parse_csv_for_db(safe_path)
            for record in records:
                is_anomaly = False
                for key, val in record.items():
                    if str(val).strip() in ["", "-", "?", ""]:
                        is_anomaly = True
                        break
                db_row = models.TableRow(table_id=table.id, data=record, is_anomaly=is_anomaly)
                db.add(db_row)
            db.commit()

        return {"message": "Data CSV berhasil disimpan"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


