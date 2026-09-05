import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Production: wajib set env DATABASE_URL. Development: default MySQL lokal XAMPP.
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "mysql+pymysql://root:@127.0.0.1:3306/bps_tasikmalaya")
_is_production = bool(os.environ.get("SIPEDAS_DOMAIN"))

if _is_production and "root:@" in SQLALCHEMY_DATABASE_URL:
    print("[SECURITY WARNING] Database menggunakan root tanpa password! Segera set DATABASE_URL yang aman.")

engine_kwargs = {"pool_pre_ping": True}
if "sqlite" not in SQLALCHEMY_DATABASE_URL.lower():
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
