from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), index=True)
    year = Column(Integer)
    status = Column(String(50), default="ready")  # ready, extracting, error
    created_at = Column(DateTime, default=datetime.utcnow)

    tables = relationship("ExtractedTable", back_populates="document", cascade="all, delete-orphan")

class ExtractedTable(Base):
    __tablename__ = "extracted_tables"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    table_name = Column(String(255), index=True) # e.g. "Tabel_1.1.1"
    csv_path = Column(String(500))
    headers = Column(JSON)  # Daftar nama kolom (urutan asli) — disimpan agar alur data tidak bergantung file CSV
    units = Column(JSON)    # Satuan per kolom
    years = Column(JSON)    # Tahun per kolom

    document = relationship("Document", back_populates="tables")
    rows = relationship("TableRow", back_populates="table", cascade="all, delete-orphan")

class TableRow(Base):
    __tablename__ = "table_rows"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("extracted_tables.id"))
    data = Column(JSON) # Stores dict of column_name: value natively in DB
    is_anomaly = Column(Boolean, default=False)
    sort_order = Column(Integer, index=True) # Urutan tampil (menunjang insert di posisi tertentu)

    table = relationship("ExtractedTable", back_populates="rows")

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String(64), primary_key=True)  # session_id (token_hex)
    role = Column(String(20), nullable=False, default="pegawai")
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    action = Column(String(50), index=True)
    target = Column(String(255))
    detail = Column(JSON)
