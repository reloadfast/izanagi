import os
from sqlmodel import create_engine, SQLModel, Session

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        db_path = os.getenv("IZANAGI_DB_PATH", "/data/izanagi.db")
        _engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False},
        )
    return _engine


def get_session():
    with Session(get_engine()) as session:
        yield session


def create_db():
    SQLModel.metadata.create_all(get_engine())
