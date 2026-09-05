import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from sqlalchemy.pool import NullPool

# Production: wajib set env DATABASE_URL. Development: default MySQL lokal XAMPP.
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "mysql+pymysql://root:@127.0.0.1:3306/bps_tasikmalaya")
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

_is_production = bool(os.environ.get("SIPEDAS_DOMAIN") or os.environ.get("VERCEL"))

if _is_production and "root:@" in SQLALCHEMY_DATABASE_URL:
    print("[SECURITY WARNING] Database menggunakan root tanpa password! Segera set DATABASE_URL yang aman.")

engine_kwargs = {"pool_pre_ping": True}
if "sqlite" in SQLALCHEMY_DATABASE_URL.lower():
    pass
elif "pooler.supabase.com" in SQLALCHEMY_DATABASE_URL or os.environ.get("VERCEL"):
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800
    })

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    **engine_kwargs
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
