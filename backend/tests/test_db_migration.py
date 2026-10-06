"""Tes migrasi index database (migrate_db_indexes)."""
from sqlalchemy import inspect, text

import models
from database import engine
from main import migrate_db_indexes


def test_migrate_db_indexes_membuat_index_yang_hilang():
    """Index yang di-drop dari DB dibuat kembali oleh migrasi, dan idempoten."""
    inspector = inspect(engine)
    assert "ix_table_rows_sort_order" in {i["name"] for i in inspector.get_indexes("table_rows")}

    with engine.begin() as conn:
        conn.execute(text("DROP INDEX ix_table_rows_sort_order"))
    assert "ix_table_rows_sort_order" not in {i["name"] for i in inspect(engine).get_indexes("table_rows")}

    migrate_db_indexes()
    assert "ix_table_rows_sort_order" in {i["name"] for i in inspect(engine).get_indexes("table_rows")}

    # Pemanggilan kedua tidak error dan tidak mengubah apa pun.
    migrate_db_indexes()
    assert "ix_table_rows_sort_order" in {i["name"] for i in inspect(engine).get_indexes("table_rows")}


def test_index_fk_table_rows_ada():
    """FK table_rows.table_id wajib punya index (dulu seq scan tiap buka tabel)."""
    idx = {i["name"]: i for i in inspect(engine).get_indexes("table_rows")}
    assert "ix_table_rows_table_id" in idx
    assert [c for c in idx["ix_table_rows_table_id"]["column_names"]] == ["table_id"]


def test_seluruh_index_model_ada_di_db():
    """Setiap index yang dideklarasikan model harus tercipta di database."""
    inspector = inspect(engine)
    for table in models.Base.metadata.sorted_tables:
        existing = {i["name"] for i in inspector.get_indexes(table.name)}
        for index in table.indexes:
            if index.name:
                assert index.name in existing, f"index {index.name} hilang di tabel {table.name}"
