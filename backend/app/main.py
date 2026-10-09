"""DocSize API entry point.

Run from the backend/ folder:  python -m uvicorn app.main:app --reload
Interactive docs:              http://127.0.0.1:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import auth, derived, documents, profiles
from app.config import settings
from app.db import get_db, init_db
from app.security import CSRF_HEADER

_DOC_PATHS = ("/docs", "/redoc", "/openapi.json")
_BODY_OVERHEAD_BYTES = 64 * 1024  # room for multipart headers and form fields


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


# The interactive docs are for development. In production they are switched off, so the API surface is not published.
is_production = settings.app_env == "production"
app = FastAPI(
    title="DocSize API",
    version="0.2.0",
    lifespan=lifespan,
    docs_url=None if is_production else "/docs",
    redoc_url=None,
    openapi_url=None if is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", CSRF_HEADER],
)


@app.middleware("http")
async def security_headers_and_size_limit(request: Request, call_next):
    declared_length = request.headers.get("content-length")
    if declared_length and declared_length.isdigit() and int(declared_length) > settings.max_upload_bytes + _BODY_OVERHEAD_BYTES:
        return JSONResponse(
            status_code=413,
            content={"detail": f"The request is too large. Files must be {settings.max_upload_mb} MB or smaller."},
        )

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    if not request.url.path.startswith(_DOC_PATHS):
        # The API returns JSON and files only, so nothing it serves needs scripts or framing.
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    if settings.cookie_secure:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(documents.router)
app.include_router(derived.router)


@app.get("/health", tags=["system"])
def health(db: Session = Depends(get_db)) -> dict:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
