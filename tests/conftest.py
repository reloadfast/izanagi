import os

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, StaticPool, create_engine

import app.db as db_module
from app.main import app  # noqa: E402 — registers models in SQLModel.metadata

AUTH_TOKEN = "test-bootstrap-token"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("IZANAGI_TEMPLATES_PATH", str(tmp_path / "templates"))
    monkeypatch.setenv("IZANAGI_BOOTSTRAP_TOKEN", AUTH_TOKEN)

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    db_module._engine = engine

    with TestClient(app) as c:
        yield c

    engine.dispose()
    db_module._engine = None


@pytest.fixture()
def auth_headers():
    return {"Authorization": f"Bearer {AUTH_TOKEN}"}
