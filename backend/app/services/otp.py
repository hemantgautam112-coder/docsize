"""One-time password issuing and verification.

Codes are stored only as HMAC-SHA256 hashes keyed with SECRET_KEY. Delivery goes through
an OtpProvider adapter, so an SMS or email provider can replace the console one later.
"""

import hashlib
import hmac
import re
import secrets
import smtplib
from datetime import timedelta
from email.message import EmailMessage
from typing import Protocol

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.db import utcnow
from app.models import OtpCode

OTP_LENGTH = 6
GENERIC_INVALID_MESSAGE = "The code is incorrect or has expired. Please try again or request a new code."

_MOBILE_PATTERN = re.compile(r"^[6-9]\d{9}$")  # Indian mobile numbers
_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class OtpError(Exception):
    """Base class for OTP failures. The message is safe to show to the user."""


class InvalidIdentifierError(OtpError):
    pass


class OtpRateLimitedError(OtpError):
    pass


class OtpLockedError(OtpError):
    """Too many wrong codes. The address is locked for a while. The message is the same for every address."""


class OtpInvalidError(OtpError):
    """Wrong, expired, or locked-out code. One message for all three, so the response reveals nothing extra."""


class OtpProvider(Protocol):
    def send_code(self, identifier: str, code: str) -> None:
        """Deliver the code to the identifier (mobile number or email)."""


class ConsoleOtpProvider:
    """Development only. Prints the code to the server console and never writes it to a file."""

    def send_code(self, identifier: str, code: str) -> None:
        print(
            f"\n[HDVault DEV] OTP for {mask_identifier(identifier)}: {code} "
            f"(valid {settings.otp_ttl_minutes} min)\n",
            flush=True,
        )


class SmtpOtpProvider:
    """Sends the code by email over SMTP. Works with Gmail (app password), Mailpit, or any SMTP server."""

    def send_code(self, identifier: str, code: str) -> None:
        message = EmailMessage()
        message["Subject"] = "Your HDVault login code"
        message["From"] = settings.smtp_from or settings.smtp_username
        message["To"] = identifier
        message.set_content(
            f"Your HDVault code is {code}.\n\n"
            f"It expires in {settings.otp_ttl_minutes} minutes. Never share this code with anyone.\n\n"
            "If you did not ask for this code, you can ignore this email.\n"
        )
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)


class RoutingOtpProvider:
    """Email codes go by SMTP when it is configured. Mobile codes use the console until an SMS provider exists."""

    def send_code(self, identifier: str, code: str) -> None:
        if "@" in identifier:
            if settings.smtp_host:
                SmtpOtpProvider().send_code(identifier, code)
            else:
                ConsoleOtpProvider().send_code(identifier, code)
            return
        if settings.app_env == "production":
            raise RuntimeError("SMS delivery is not configured yet.")
        ConsoleOtpProvider().send_code(identifier, code)


def get_otp_provider() -> OtpProvider:
    return RoutingOtpProvider()


def normalize_identifier(raw: str) -> str:
    """Return a canonical identifier: 10-digit mobile or lowercase email. Raises InvalidIdentifierError."""
    value = raw.strip()
    if "@" in value:
        value = value.lower()
        if len(value) > 254 or not _EMAIL_PATTERN.match(value):
            raise InvalidIdentifierError("Enter a valid email address.")
        return value

    digits = re.sub(r"[\s\-]", "", value)
    if digits.startswith("+91"):
        digits = digits[3:]
    elif digits.startswith("0091"):
        digits = digits[4:]
    if not _MOBILE_PATTERN.match(digits):
        raise InvalidIdentifierError("Enter a valid 10-digit mobile number.")
    return digits


def identifier_kind(identifier: str) -> str:
    return "email" if "@" in identifier else "mobile"


def mask_identifier(identifier: str) -> str:
    """Hide most of a mobile number or email for logs and console output."""
    if "@" in identifier:
        local, _, domain = identifier.partition("@")
        return f"{local[:1]}***@{domain}"
    return f"******{identifier[-4:]}"


def _hash_code(identifier: str, code: str) -> str:
    message = f"{identifier}:{code}".encode()
    return hmac.new(settings.secret_key.encode(), message, hashlib.sha256).hexdigest()


def request_otp(db: Session, raw_identifier: str, provider: OtpProvider | None = None) -> str:
    """Create and send a new code. Returns the normalized identifier.

    Any older unused code for the same identifier is invalidated, so only the newest code works.
    """
    identifier = normalize_identifier(raw_identifier)
    now = utcnow()

    window_start = now - timedelta(minutes=settings.otp_request_window_minutes)
    recent_requests = db.scalar(
        select(func.count())
        .select_from(OtpCode)
        .where(OtpCode.identifier == identifier, OtpCode.created_at >= window_start)
    )
    if (recent_requests or 0) >= settings.otp_request_limit:
        raise OtpRateLimitedError(
            f"Too many codes requested. Please wait {settings.otp_request_window_minutes} minutes and try again."
        )

    day_start = now - timedelta(hours=24)
    requests_today = db.scalar(
        select(func.count())
        .select_from(OtpCode)
        .where(OtpCode.identifier == identifier, OtpCode.created_at >= day_start)
    )
    if (requests_today or 0) >= settings.otp_requests_per_day:
        raise OtpRateLimitedError("Too many codes have been sent to this address today. Please try again tomorrow.")

    db.execute(
        update(OtpCode)
        .where(OtpCode.identifier == identifier, OtpCode.consumed_at.is_(None))
        .values(consumed_at=now)
    )

    code = f"{secrets.randbelow(10**OTP_LENGTH):0{OTP_LENGTH}d}"
    db.add(
        OtpCode(
            identifier=identifier,
            code_hash=_hash_code(identifier, code),
            attempts=0,
            created_at=now,
            expires_at=now + timedelta(minutes=settings.otp_ttl_minutes),
        )
    )
    db.commit()

    (provider or get_otp_provider()).send_code(identifier, code)
    return identifier


def verify_otp(db: Session, raw_identifier: str, code: str) -> str:
    """Check a code. Returns the normalized identifier on success and consumes the code.

    Raises OtpInvalidError for wrong, expired, consumed, or locked-out codes.
    """
    identifier = normalize_identifier(raw_identifier)
    now = utcnow()

    # Lock the address after too many wrong codes within the lock window.
    lock_start = now - timedelta(minutes=settings.otp_lock_minutes)
    recent_wrong = db.scalar(
        select(func.coalesce(func.sum(OtpCode.attempts), 0)).where(
            OtpCode.identifier == identifier, OtpCode.created_at >= lock_start
        )
    )
    if (recent_wrong or 0) >= settings.otp_max_attempts:
        raise OtpLockedError(
            f"Too many wrong codes. Please wait {settings.otp_lock_minutes} minutes before trying again."
        )

    otp = db.scalar(
        select(OtpCode)
        .where(OtpCode.identifier == identifier, OtpCode.consumed_at.is_(None))
        .order_by(OtpCode.created_at.desc(), OtpCode.id.desc())
        .limit(1)
    )
    if otp is None or otp.expires_at <= now or otp.attempts >= settings.otp_max_attempts:
        raise OtpInvalidError(GENERIC_INVALID_MESSAGE)

    # Count the attempt before checking the code, so guesses cannot bypass the limit.
    # Note: this is not row-locked, so parallel guesses could slip past the limit by a few.
    # Rate limiting at the HTTP layer (added in part 2) covers that gap.
    otp.attempts += 1
    candidate_hash = _hash_code(identifier, code.strip())
    if not hmac.compare_digest(otp.code_hash, candidate_hash):
        db.commit()
        raise OtpInvalidError(GENERIC_INVALID_MESSAGE)

    otp.consumed_at = now
    db.commit()
    return identifier


def purge_expired_otps(db: Session, older_than_hours: int = 24) -> int:
    """Delete OTP rows that expired more than `older_than_hours` ago. Returns the number deleted."""
    cutoff = utcnow() - timedelta(hours=older_than_hours)
    result = db.execute(delete(OtpCode).where(OtpCode.expires_at < cutoff))
    db.commit()
    return result.rowcount or 0
