from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DocumentBase(BaseModel):
    filename: str
    year: int
    data_year: int | None = None

class DocumentCreate(DocumentBase):
    pass

class DocumentOut(DocumentBase):
    id: int
    status: str
    created_at: datetime
    table_count: int | None = 0
    model_config = {"from_attributes": True}

class ExtractedTableOut(BaseModel):
    id: int
    document_id: int
    table_name: str
    csv_path: str
    has_db_data: bool = False
    model_config = {"from_attributes": True}

class TableRowBase(BaseModel):
    data: dict[str, Any]

class TableRowCreate(TableRowBase):
    table_id: int

class TableRowOut(TableRowBase):
    id: int
    table_id: int
    model_config = {"from_attributes": True}

class CreateTableRequest(BaseModel):
    document_id: int
    table_name: str
    headers: list[str]
    units: list[str] | None = None
    years: list[str] | None = None
    auto_fill_kecamatan: bool = False
    entity_preset: str | None = "kecamatan"
    custom_rows_count: int | None = 10
    custom_entities: list[str] | None = None
    rows: list[dict[str, Any]] | None = None
