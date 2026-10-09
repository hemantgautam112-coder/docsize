"""Session and CSRF helpers.

The session is a signed JWT in an httpOnly cookie. CSRF uses the double-submit pattern: a
non-httpOnly cookie must match the X-CSRF-Token header on every state-changing request.
"""

import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Request, Response

from app.config import settings

SESSION_COOKIE = "docsize_session"
CSRF_COOKIE = "docsize_csrf"
CSRF_HEADER = "X-CSRF-Token"
_JWT_ALGORITHM = "HS256"


def create_session_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=settings.jwt_expire_minutes)}
    return jwt.encode(payload, settings.secret_key, algorithm=_JWT_ALGORITHM)


def read_session_user_id(token: str) -> int | None:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[_JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        return int(payload["sub"])
    except (jwt.PyJWTError, ValueError, TypeError):
        return None


def set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        create_session_token(user_id),
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/", secure=settings.cookie_secure, httponly=True, samesite="lax")


def ensure_csrf_cookie(request: Request, response: Response) -> str:
    """Return the existing CSRF token, or issue a new one. The cookie is readable by the frontend."""
    token = request.cookies.get(CSRF_COOKIE) or secrets.token_urlsafe(32)
    response.set_cookie(
        CSRF_COOKIE,
        token,
        max_age=settings.jwt_expire_minutes * 60,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return token
