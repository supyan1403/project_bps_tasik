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
    model_config = {"from_attributes": True}

class ExtractedTableOut(BaseModel):
    id: int
    document_id: int
    table_name: str
    csv_path: str
    model_config = {"from_attributes": True}

class TableRowBase(BaseModel):
    data: Dict[str, Any]

class TableRowCreate(TableRowBase):
    table_id: int

class TableRowOut(TableRowBase):
    id: int
    table_id: int
    model_config = {"from_attributes": True}
