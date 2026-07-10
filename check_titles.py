import sys, os
sys.path.insert(0, 'backend')
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from backend.database import SQLALCHEMY_DATABASE_URL

engine = create_engine(SQLALCHEMY_DATABASE_URL)

with Session(engine) as session:
    result = session.execute(text("""
        SELECT e.id, e.table_name, d.filename, d.id as doc_id
        FROM extracted_tables e
        JOIN documents d ON d.id = e.document_id
        ORDER BY d.filename, e.table_name
    """)).fetchall()
    
    print(f"Total tables: {len(result)}\n")
    
    truncated = []
    for r in result:
        name = r.table_name or ""
        is_truncated = name.endswith("...") or name.endswith(".")
        status = "[TRUNCATED]" if is_truncated else "[OK]"
        print(f"  {status} id={r.id:5d} [{r.filename[:30]}] {name[:90]}")
        if is_truncated:
            truncated.append(r)
    
    print(f"\nTruncated: {len(truncated)}/{len(result)}")
