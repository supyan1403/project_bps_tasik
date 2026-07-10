import sys, os
sys.path.insert(0, 'backend')
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from backend.database import SQLALCHEMY_DATABASE_URL

engine = create_engine(SQLALCHEMY_DATABASE_URL)

with Session(engine) as session:
    # Cari SEMUA duplikat (document_id + table_name sama, lebih dari 1 entry)
    result = session.execute(text("""
        SELECT e.document_id, e.table_name, COUNT(*) as cnt,
               d.filename
        FROM extracted_tables e
        JOIN documents d ON d.id = e.document_id
        GROUP BY e.document_id, e.table_name, d.filename
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
    """)).fetchall()
    
    if not result:
        print("Tidak ada duplikat tersisa. Database bersih.")
    else:
        print(f"Ditemukan {len(result)} grup duplikat:\n")
        for r in result:
            print(f"  [{r.filename}] {r.table_name[:70]}")
            print(f"    {r.cnt} entry duplikat")
            
            # Tampilkan ID
            ids = session.execute(text("""
                SELECT id FROM extracted_tables 
                WHERE document_id = :did AND table_name = :tname
                ORDER BY id
            """), {"did": r.document_id, "tname": r.table_name}).fetchall()
            print(f"    IDs: {[id[0] for id in ids]}")
            
            # Cek jumlah baris per entry
            for id_tuple in ids:
                tid = id_tuple[0]
                row_count = session.execute(text(
                    "SELECT COUNT(*) FROM table_rows WHERE table_id = :tid"
                ), {"tid": tid}).scalar()
                print(f"      id={tid}: {row_count} baris")
            print()
