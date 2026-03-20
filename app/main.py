import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.db import create_db
from app.routes import deploy, history, restart, templates, tokens, version


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()
    yield


app = FastAPI(title="Izanagi", version=__version__, lifespan=lifespan)

app.include_router(version.router, prefix="/api")
app.include_router(deploy.router, prefix="/api")
app.include_router(tokens.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(restart.router, prefix="/api")
app.include_router(templates.router, prefix="/api")

_static_dir = str(Path(__file__).parent / "static")
app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
