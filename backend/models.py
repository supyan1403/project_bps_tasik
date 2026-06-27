from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    year = Column(Integer)
    status = Column(String, default="ready")  # ready, extracting, error
    created_at = Column(DateTime, default=datetime.utcnow)

    tables = relationship("ExtractedTable", back_populates="document", cascade="all, delete-orphan")

class ExtractedTable(Base):
    __tablename__ = "extracted_tables"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    table_name = Column(String, index=True) # e.g. "Tabel_1.1.1"
    csv_path = Column(String)

    document = relationship("Document", back_populates="tables")
    rows = relationship("TableRow", back_populates="table", cascade="all, delete-orphan")

class TableRow(Base):
    __tablename__ = "table_rows"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("extracted_tables.id"))
    data = Column(JSONB) # Stores dict of column_name: value natively in Postgres
    is_anomaly = Column(Boolean, default=False)
    
    table = relationship("ExtractedTable", back_populates="rows")
