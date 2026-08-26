from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime

class DocumentBase(BaseModel):
    filename: str
    year: int

class DocumentCreate(DocumentBase):
    pass

class DocumentOut(DocumentBase):
    id: int
    status: str
    created_at: datetime
    table_count: Optional[int] = 0
    model_config = {"from_attributes": True}

class ExtractedTableOut(BaseModel):
    id: int
    document_id: int
    table_name: str
    csv_path: str
    has_db_data: bool = False
    model_config = {"from_attributes": True}

class TableRowBase(BaseModel):
    data: Dict[str, Any]

class TableRowCreate(TableRowBase):
    table_id: int

class TableRowOut(TableRowBase):
    id: int
    table_id: int
    model_config = {"from_attributes": True}

class CreateTableRequest(BaseModel):
    document_id: int
    table_name: str
    headers: List[str]
    units: Optional[List[str]] = None
    years: Optional[List[str]] = None
    auto_fill_kecamatan: bool = False
    entity_preset: Optional[str] = "kecamatan" # "kecamatan", "bulan", "lapangan_usaha", "komoditas", "agama", "pendidikan", "custom_empty"
    custom_rows_count: Optional[int] = 10
    custom_entities: Optional[List[str]] = None
    rows: Optional[List[Dict[str, Any]]] = None

