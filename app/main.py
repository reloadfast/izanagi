import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app import __version__
from app.db import create_db
from app.routes import deploy, history, restart, templates, tokens, version


MAX_BODY_SIZE = int(os.getenv("IZANAGI_MAX_BODY_SIZE", str(1024 * 1024)))  # default 1 MB


class ContentSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_SIZE:
            return Response("Request body too large", status_code=413)
        body = await request.body()
        if len(body) > MAX_BODY_SIZE:
            return Response("Request body too large", status_code=413)
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()
    yield


app = FastAPI(title="Izanagi", version=__version__, lifespan=lifespan)
app.add_middleware(ContentSizeLimitMiddleware)

app.include_router(version.router, prefix="/api")
app.include_router(deploy.router, prefix="/api")
app.include_router(tokens.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(restart.router, prefix="/api")
app.include_router(templates.router, prefix="/api")

_static_dir = str(Path(__file__).parent / "static")
app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
