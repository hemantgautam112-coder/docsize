"""Shared FastAPI dependencies: login, admin, CSRF, rate limits, and ownership checks."""

import hmac

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import DerivedFile, OriginalDocument, User
from app.security import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, read_session_user_id
from app.services.rate_limit import limiter

__all__ = ["get_db", "get_current_user", "require_admin", "verify_csrf", "rate_limit_by_ip",
           "rate_limit_by_user", "get_owned_original", "get_owned_derived"]


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    user_id = read_session_user_id(token) if token else None
    user = db.get(User, user_id) if user_id is not None else None
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Please log in to continue.")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Only administrators can do this.")
    return user


def verify_csrf(request: Request, csrf_header: str | None = Header(default=None, alias=CSRF_HEADER)) -> None:
    cookie = request.cookies.get(CSRF_COOKIE)
    if not cookie or not csrf_header or not hmac.compare_digest(cookie, csrf_header):
        raise HTTPException(status_code=403, detail="Security check failed. Reload the page and try again.")


def _enforce(key: str, limit: int, window_seconds: int) -> None:
    if not limiter.allow(key, limit, window_seconds):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a while and try again.")


def rate_limit_by_ip(scope: str, limit: int, window_seconds: int):
    def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        _enforce(f"{scope}:ip:{client_ip}", limit, window_seconds)

    return dependency


def rate_limit_by_user(scope: str, limit: int, window_seconds: int):
    def dependency(user: User = Depends(get_current_user)) -> None:
        _enforce(f"{scope}:user:{user.id}", limit, window_seconds)

    return dependency


def get_owned_original(db: Session, document_id: str, user: User) -> OriginalDocument:
    doc = db.get(OriginalDocument, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this document.")
    return doc


def get_owned_derived(db: Session, derived_id: str, user: User) -> DerivedFile:
    row = db.get(DerivedFile, derived_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Processed file not found.")
    if row.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this file.")
    return row
