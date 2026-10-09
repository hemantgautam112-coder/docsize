"""Sign-up, login, Google sign-in, logout, and account deletion.

Sign-up creates an account and needs consent. Login needs an existing account. Both use a
one-time code, or Google. The API returns a clear error for the wrong choice, for example
"No account found. Sign up first." This reveals whether an account exists. That is an accepted
trade-off for a clearer experience.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, rate_limit_by_ip, verify_csrf
from app.config import settings
from app.db import get_db, utcnow
from app.models import User
from app.schemas import CsrfOut, GoogleLoginIn, MessageOut, OtpRequestIn, OtpVerifyIn, UserOut
from app.security import clear_session_cookie, ensure_csrf_cookie, set_session_cookie
from app.services.accounts import delete_account
from app.services.google_auth import GoogleAuthError, GoogleNotConfiguredError, verify_google_credential
from app.services.otp import (
    InvalidIdentifierError,
    OtpInvalidError,
    OtpProvider,
    OtpRateLimitedError,
    get_otp_provider,
    identifier_kind,
    mask_identifier,
    normalize_identifier,
    request_otp,
    verify_otp,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_OTP_WINDOW_SECONDS = settings.otp_request_window_minutes * 60
_NO_ACCOUNT = "No account found for this {kind}. Sign up first."
_ALREADY_REGISTERED = "An account already exists for this {kind}. Log in instead."


@router.get("/csrf", response_model=CsrfOut)
def get_csrf_token(request: Request, response: Response) -> CsrfOut:
    """Call this first. It sets the CSRF cookie and returns the token to send as X-CSRF-Token."""
    return CsrfOut(csrf_token=ensure_csrf_cookie(request, response))


@router.post(
    "/request-otp",
    response_model=MessageOut,
    status_code=202,
    dependencies=[
        Depends(verify_csrf),
        Depends(rate_limit_by_ip("otp-request", settings.otp_requests_per_ip, _OTP_WINDOW_SECONDS)),
    ],
)
def request_login_code(
    body: OtpRequestIn,
    db: Session = Depends(get_db),
    provider: OtpProvider = Depends(get_otp_provider),
) -> MessageOut:
    identifier = _normalize_or_422(body.identifier)
    _check_purpose(db, identifier, body.purpose)
    try:
        request_otp(db, identifier, provider)
    except OtpRateLimitedError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    return MessageOut(
        message=f"We sent a 6-digit code to {mask_identifier(identifier)}. It expires in {settings.otp_ttl_minutes} minutes."
    )


@router.post(
    "/verify-otp",
    response_model=UserOut,
    dependencies=[
        Depends(verify_csrf),
        Depends(rate_limit_by_ip("otp-verify", settings.otp_verifies_per_ip, _OTP_WINDOW_SECONDS)),
    ],
)
def verify_login_code(body: OtpVerifyIn, response: Response, db: Session = Depends(get_db)) -> User:
    try:
        identifier = verify_otp(db, body.identifier, body.code)
    except InvalidIdentifierError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OtpInvalidError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    user = _find_user(db, identifier)
    kind = identifier_kind(identifier)
    if body.purpose == "signup":
        if user is not None:
            raise HTTPException(status_code=409, detail=_ALREADY_REGISTERED.format(kind=kind))
        if not body.consent:
            raise HTTPException(status_code=400, detail="Please accept the privacy policy to create your account.")
        user = _create_user(db, mobile=identifier if kind == "mobile" else None, email=identifier if kind == "email" else None)
    elif user is None:
        raise HTTPException(status_code=404, detail=_NO_ACCOUNT.format(kind=kind))

    return _sign_in(response, db, user)


@router.post(
    "/google",
    response_model=UserOut,
    dependencies=[
        Depends(verify_csrf),
        Depends(rate_limit_by_ip("google", settings.otp_verifies_per_ip, _OTP_WINDOW_SECONDS)),
    ],
)
def google_sign_in(body: GoogleLoginIn, response: Response, db: Session = Depends(get_db)) -> User:
    try:
        identity = verify_google_credential(body.credential)
    except GoogleNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail="Google sign-in is not set up yet. Use the code option instead.") from exc
    except GoogleAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    user = db.scalar(select(User).where(User.google_sub == identity.sub)) or db.scalar(
        select(User).where(User.email == identity.email)
    )
    if body.purpose == "signup":
        if user is not None:
            raise HTTPException(status_code=409, detail=_ALREADY_REGISTERED.format(kind="Google account"))
        if not body.consent:
            raise HTTPException(status_code=400, detail="Please accept the privacy policy to create your account.")
        user = _create_user(db, email=identity.email, google_sub=identity.sub)
    elif user is None:
        raise HTTPException(status_code=404, detail=_NO_ACCOUNT.format(kind="Google account"))
    elif user.google_sub is None:
        user.google_sub = identity.sub  # link Google to an account that already exists with this email
        db.commit()

    return _sign_in(response, db, user)


@router.post("/logout", response_model=MessageOut, dependencies=[Depends(verify_csrf)])
def logout(response: Response) -> MessageOut:
    clear_session_cookie(response)
    return MessageOut(message="You have been logged out.")


@router.get("/me", response_model=UserOut)
def read_current_user(user: User = Depends(get_current_user)) -> User:
    return user


@router.delete("/account", status_code=204, dependencies=[Depends(verify_csrf)])
def delete_my_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    delete_account(db, user)
    response = Response(status_code=204)
    clear_session_cookie(response)
    return response


def _normalize_or_422(raw: str) -> str:
    try:
        return normalize_identifier(raw)
    except InvalidIdentifierError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _check_purpose(db: Session, identifier: str, purpose: str) -> None:
    user = _find_user(db, identifier)
    kind = identifier_kind(identifier)
    if purpose == "signup" and user is not None:
        raise HTTPException(status_code=409, detail=_ALREADY_REGISTERED.format(kind=kind))
    if purpose == "login" and user is None:
        raise HTTPException(status_code=404, detail=_NO_ACCOUNT.format(kind=kind))


def _find_user(db: Session, identifier: str) -> User | None:
    column = User.email if identifier_kind(identifier) == "email" else User.mobile
    return db.scalar(select(User).where(column == identifier))


def _create_user(db: Session, *, mobile: str | None = None, email: str | None = None, google_sub: str | None = None) -> User:
    user = User(
        mobile=mobile,
        email=email,
        google_sub=google_sub,
        is_admin=email is not None and email in settings.admin_email_set,
        consent_accepted_at=utcnow(),
        created_at=utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _sign_in(response: Response, db: Session, user: User) -> User:
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been disabled.")
    if user.email and user.email in settings.admin_email_set and not user.is_admin:
        user.is_admin = True
        db.commit()
    set_session_cookie(response, user.id)
    return user
