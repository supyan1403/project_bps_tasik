import os
import glob
import subprocess
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy.engine import make_url

import models
from database import engine, get_db
from routers.auth import require_admin, log_activity

router = APIRouter(prefix="/api/admin", tags=["Admin & Backups"])

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_DIR = os.path.abspath(os.path.join(_BASE_DIR, "..", "backups"))
if not os.path.exists(os.path.dirname(BACKUP_DIR)):
    BACKUP_DIR = "/tmp/backups" if os.environ.get("VERCEL") else BACKUP_DIR

try:
    os.makedirs(BACKUP_DIR, exist_ok=True)
except Exception:
    pass

def cleanup_old_backups(keep: int = 10):
    """Hapus backup lama, sisakan N terbaru berdasarkan waktu modifikasi."""
    files = sorted(
        glob.glob(os.path.join(BACKUP_DIR, "*.sql")),
        key=os.path.getmtime,
        reverse=True
    )
    for f in files[keep:]:
        try:
            os.remove(f)
        except Exception:
            pass

def backup_database() -> str:
    """Buat dump .sql seluruh database ke BACKUP_DIR, kembali nama file backup."""
    url = make_url(engine.url)
    db_backend = url.get_backend_name().lower()
    db_name = url.database or "sipedas"

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"bps_{db_name}_{ts}.sql"
    backup_path = os.path.join(BACKUP_DIR, backup_name)

    # 1. Jika MySQL lokal, coba mysqldump jika tersedia
    if "mysql" in db_backend:
        user = url.username or "root"
        password = url.password or ""
        mysqldump_candidates = [
            r"D:\xampp\mysql\bin\mysqldump.exe",
            r"C:\xampp\mysql\bin\mysqldump.exe",
            r"D:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysqldump.exe",
            "mysqldump",
        ]
        import shutil
        for _pattern in [
            r"C:\Program Files\MySQL\MySQL Server *\bin\mysqldump.exe",
            r"C:\Program Files (x86)\MySQL\MySQL Server *\bin\mysqldump.exe",
        ]:
            mysqldump_candidates.extend(glob.glob(_pattern))

        mysqldump = next((c for c in mysqldump_candidates if shutil.which(c) or os.path.exists(c)), None)
        if mysqldump:
            cmd = [mysqldump, "-u", user, "--skip-comments", db_name]
            if password:
                cmd.insert(2, f"-p{password}")
            with open(backup_path, "w", encoding="utf-8", errors="replace") as f:
                result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, check=False)
            fsize = os.path.getsize(backup_path) if os.path.exists(backup_path) else -1
            if os.path.exists(backup_path) and fsize > 0:
                cleanup_old_backups()
                return backup_path

    # 2. Universal ORM Dump (Bekerja sempurna untuk PostgreSQL Supabase, SQLite, atau MySQL tanpa binary eksternal)
    import json
    from database import SessionLocal
    db = SessionLocal()
    try:
        lines = []
        lines.append(f"-- SIPEDAS Universal SQL Database Backup ({db_backend.upper()})")
        lines.append(f"-- Backup Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"-- Database: {db_name}")
        lines.append("")

        def sql_quote(val):
            if val is None:
                return "NULL"
            if isinstance(val, bool):
                return "TRUE" if val else "FALSE"
            if isinstance(val, (int, float)):
                return str(val)
            if isinstance(val, (dict, list)):
                val = json.dumps(val, ensure_ascii=False)
            s = str(val).replace("'", "''")
            return f"'{s}'"

        # Backup system_config
        configs = db.query(models.SystemConfig).all()
        lines.append(f"-- Table: system_config ({len(configs)} records)")
        for c in configs:
            lines.append(f"INSERT INTO system_config (key, value, updated_at) VALUES ({sql_quote(c.key)}, {sql_quote(c.value)}, {sql_quote(c.updated_at.strftime('%Y-%m-%d %H:%M:%S') if c.updated_at else None)});")
        lines.append("")

        # Backup documents
        docs = db.query(models.Document).order_by(models.Document.id.asc()).all()
        lines.append(f"-- Table: documents ({len(docs)} records)")
        for d in docs:
            lines.append(f"INSERT INTO documents (id, filename, year, status, created_at) VALUES ({d.id}, {sql_quote(d.filename)}, {d.year or 'NULL'}, {sql_quote(d.status)}, {sql_quote(d.created_at.strftime('%Y-%m-%d %H:%M:%S') if d.created_at else None)});")
        lines.append("")

        # Backup extracted_tables
        tables = db.query(models.ExtractedTable).order_by(models.ExtractedTable.id.asc()).all()
        lines.append(f"-- Table: extracted_tables ({len(tables)} records)")
        for t in tables:
            lines.append(f"INSERT INTO extracted_tables (id, document_id, table_name, csv_path, headers, units, years) VALUES ({t.id}, {t.document_id}, {sql_quote(t.table_name)}, {sql_quote(t.csv_path)}, {sql_quote(t.headers)}, {sql_quote(t.units)}, {sql_quote(t.years)});")
        lines.append("")

        # Backup table_rows
        rows = db.query(models.TableRow).order_by(models.TableRow.id.asc()).all()
        lines.append(f"-- Table: table_rows ({len(rows)} records)")
        for r in rows:
            lines.append(f"INSERT INTO table_rows (id, table_id, data, is_anomaly, sort_order) VALUES ({r.id}, {r.table_id}, {sql_quote(r.data)}, {sql_quote(r.is_anomaly)}, {r.sort_order if r.sort_order is not None else 0});")
        lines.append("")

        # Backup activity_logs (last 500)
        logs = db.query(models.ActivityLog).order_by(models.ActivityLog.id.desc()).limit(500).all()
        lines.append(f"-- Table: activity_logs ({len(logs)} records)")
        for l in reversed(logs):
            lines.append(f"INSERT INTO activity_logs (id, timestamp, action, target, detail) VALUES ({l.id}, {sql_quote(l.timestamp.strftime('%Y-%m-%d %H:%M:%S') if l.timestamp else None)}, {sql_quote(l.action)}, {sql_quote(l.target)}, {sql_quote(l.detail)});")
        lines.append("")

        with open(backup_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        fsize = os.path.getsize(backup_path) if os.path.exists(backup_path) else 0
        if fsize > 0:
            cleanup_old_backups()
            return backup_path
        raise RuntimeError("File backup yang dihasilkan berukuran 0 byte.")
    finally:
        db.close()

def restore_database(backup_path: str) -> dict:
    """Restore database dari file backup .sql."""
    if not os.path.exists(backup_path):
        raise FileNotFoundError(f"File backup tidak ditemukan: {backup_path}")

    # 1. Emergency safety auto-backup sebelum proses restore
    pre_backup_path = None
    try:
        pre_backup_path = backup_database()
    except Exception as eb:
        print(f"Warning: gagal membuat pre-restore auto backup: {eb}")

    # 2. Universal SQL execution via SQLAlchemy Session
    from sqlalchemy import text
    from database import SessionLocal
    db = SessionLocal()
    success_stmts = 0
    try:
        with open(backup_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        # Pisahkan statement berdasarkan titik koma di akhir baris
        stmts = [s.strip() for s in content.split(";\n") if s.strip() and not s.strip().startswith("--")]
        for stmt in stmts:
            if not stmt or stmt.startswith("--"):
                continue
            try:
                db.execute(text(stmt))
                success_stmts += 1
            except Exception as se:
                # Lewati error duplikasi / minor
                pass
        db.commit()
    except Exception as e:
        db.rollback()
        raise RuntimeError(f"Gagal me-restore database: {str(e)}")
    finally:
        db.close()

    return {
        "message": f"Database berhasil dipulihkan (restore)! {success_stmts} statement dijalankan.",
        "restored_file": os.path.basename(backup_path),
        "pre_backup": os.path.basename(pre_backup_path) if pre_backup_path else None
    }

class RestoreRequest(BaseModel):
    filename: str

@router.get("/activity-logs")
def get_activity_logs(page: int = 1, limit: int = 20, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Daftar riwayat aktivitas admin terbaru."""
    try:
        total = db.query(models.ActivityLog).count()
        logs = (
            db.query(models.ActivityLog)
            .order_by(models.ActivityLog.timestamp.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return {
            "logs": [
                {
                    "id": l.id,
                    "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S") if l.timestamp else "",
                    "action": l.action,
                    "target": l.target or "",
                    "detail": l.detail or {}
                }
                for l in logs
            ],
            "total": total,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/backup")
def create_backup(admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Backup manual seluruh database ke folder backups/."""
    try:
        path = backup_database()
        file_size = os.path.getsize(path) if os.path.exists(path) else 0
        log_activity(db, "backup", os.path.basename(path), {"size": file_size})
        return {
            "message": "Backup berhasil dibuat",
            "file": os.path.basename(path),
            "path": path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup gagal: {str(e)}")

@router.get("/backups")
def list_backups(admin: dict = Depends(require_admin)):
    """Daftar file backup .sql yang ada."""
    try:
        files = []
        if os.path.isdir(BACKUP_DIR):
            for fn in sorted(os.listdir(BACKUP_DIR), reverse=True):
                if fn.lower().endswith(".sql"):
                    fp = os.path.join(BACKUP_DIR, fn)
                    files.append({
                        "file": fn,
                        "size": os.path.getsize(fp),
                        "modified": datetime.fromtimestamp(os.path.getmtime(fp)).strftime("%Y-%m-%d %H:%M:%S")
                    })
        return {"backups": files, "dir": BACKUP_DIR}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/backups/{filename}")
def download_backup_file(filename: str, admin: dict = Depends(require_admin)):
    """Unduh file backup .sql langsung dari server."""
    safe_fn = os.path.basename(filename)
    target_path = os.path.join(BACKUP_DIR, safe_fn)
    if not os.path.exists(target_path) or not os.path.isfile(target_path):
        raise HTTPException(status_code=404, detail=f"File {safe_fn} tidak ditemukan di server.")
    return FileResponse(
        path=target_path,
        filename=safe_fn,
        media_type="application/sql"
    )

@router.post("/restore")
def restore_existing_backup(req: RestoreRequest, admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Restore database dari file backup .sql yang ada di folder backups/."""
    try:
        safe_fn = os.path.basename(req.filename)
        if not safe_fn.lower().endswith(".sql"):
            raise HTTPException(status_code=400, detail="Hanya file .sql yang diperbolehkan.")
        
        target_path = os.path.join(BACKUP_DIR, safe_fn)
        if not os.path.exists(target_path):
            raise HTTPException(status_code=404, detail=f"File {safe_fn} tidak ditemukan.")
            
        res = restore_database(target_path)
        log_activity(db, "restore", safe_fn, {"restored_from": safe_fn})
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore gagal: {str(e)}")

@router.post("/restore-upload")
async def restore_uploaded_backup(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    """Upload file .sql baru dan langsung restore ke database."""
    try:
        if not file.filename.lower().endswith(".sql"):
            raise HTTPException(status_code=400, detail="File harus berekstensi .sql.")
        
        safe_fn = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.path.basename(file.filename)}"
        save_path = os.path.join(BACKUP_DIR, safe_fn)
        
        content = await file.read()
        with open(save_path, "wb") as f:
            f.write(content)
            
        res = restore_database(save_path)
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore gagal: {str(e)}")

@router.delete("/backups/{filename}")
def delete_backup_file(filename: str, admin: dict = Depends(require_admin)):
    """Hapus file backup .sql dari folder backups/."""
    try:
        safe_fn = os.path.basename(filename)
        target_path = os.path.join(BACKUP_DIR, safe_fn)
        if os.path.exists(target_path) and os.path.isfile(target_path):
            os.remove(target_path)
            return {"message": f"File {safe_fn} berhasil dihapus"}
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================================
# SYSTEM INFO
# =====================================================================

import time as _time
import platform

_server_start_time = _time.time()

_app_version = "2.0.0"

@router.get("/system-info")
def get_system_info(admin: dict = Depends(require_admin)):
    """Info sistem: versi, DB stats, uptime, dll."""
    from database import engine
    from sqlalchemy import text

    info = {
        "version": _app_version,
        "total_tables": 0,
        "total_rows": 0,
        "total_docs": 0,
        "db_size": "-",
        "uptime": "-",
        "python_version": platform.python_version(),
        "fastapi_version": "-",
    }

    try:
        db = next(get_db())
        info["total_tables"] = db.query(models.ExtractedTable).count()
        info["total_rows"] = db.query(models.TableRow).count()
        info["total_docs"] = db.query(models.Document).count()

        # DB size (MySQL)
        try:
            result = db.execute(text(
                "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb "
                "FROM information_schema.tables WHERE table_schema = DATABASE()"
            )).fetchone()
            if result and result[0]:
                info["db_size"] = f"{result[0]} MB"
        except Exception:
            info["db_size"] = "N/A"

        db.close()
    except Exception:
        pass

    # Uptime
    uptime_sec = int(_time.time() - _server_start_time)
    days = uptime_sec // 86400
    hours = (uptime_sec % 86400) // 3600
    mins = (uptime_sec % 3600) // 60
    if days > 0:
        info["uptime"] = f"{days} hari {hours} jam {mins} menit"
    elif hours > 0:
        info["uptime"] = f"{hours} jam {mins} menit"
    else:
        info["uptime"] = f"{mins} menit"

    # FastAPI version
    try:
        import fastapi
        info["fastapi_version"] = fastapi.__version__
    except Exception:
        pass

    return info
