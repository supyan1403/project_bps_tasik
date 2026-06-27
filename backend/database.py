import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# PLACEHOLDER: The user will paste their Supabase URI here.
# For example: postgresql://postgres.[project-id]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.staovyakhojystdyxbjf:bpskabtasik@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    # pool_pre_ping=True helps with connection drops in cloud DBs like Supabase
    pool_pre_ping=True
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
