"""Application settings, loaded from environment variables and an optional .env file."""

import secrets
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"

    # Signs OTP hashes and (later) JWTs. Must be set in production.
    secret_key: str = ""

    database_url: str = f"sqlite:///{(PROJECT_ROOT / 'storage' / 'docsize.db').as_posix()}"

    # Adapter selection. Only "local" exists for now; "s3" is the planned next adapter.
    storage_backend: Literal["local"] = "local"
    storage_dir: str = "storage"

    # Email OTP is sent over SMTP when smtp_host is set. Mobile OTP uses the console until an SMS provider exists.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_use_tls: bool = True
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    otp_ttl_minutes: int = 5
    otp_max_attempts: int = 3
    otp_request_limit: int = 3
    otp_request_window_minutes: int = 15

    max_upload_mb: int = 10
    derived_retention_days: int = 30

    frontend_origin: str = "http://localhost:5173"
    cookie_secure: bool = False

    jwt_expire_minutes: int = 60 * 24 * 7

    # OAuth client ID from Google Cloud Console. Leave empty to disable Google sign-in.
    google_client_id: str = ""
    # Comma-separated. An account with one of these emails is made an admin on login.
    admin_emails: str = ""

    otp_requests_per_ip: int = 20
    otp_verifies_per_ip: int = 60
    uploads_per_hour: int = 60
    processes_per_hour: int = 60

    max_image_pixels: int = 40_000_000
    max_pdf_pages: int = 50

    @model_validator(mode="after")
    def _check_settings(self) -> "Settings":
        if not self.secret_key:
            if self.app_env == "production":
                raise ValueError("SECRET_KEY must be set in production.")
            # Development only: a throwaway key so the app still starts without a .env.
            # Restarting the server invalidates pending OTPs and login sessions.
            self.secret_key = secrets.token_urlsafe(48)
        elif len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long.")

        if self.app_env == "production" and not self.smtp_host:
            raise ValueError("SMTP_HOST must be set in production so OTP codes can be emailed.")
        if self.app_env == "production" and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE must be true in production (HTTPS only).")
        return self

    @property
    def storage_path(self) -> Path:
        path = Path(self.storage_dir)
        return path if path.is_absolute() else PROJECT_ROOT / path

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def admin_email_set(self) -> frozenset[str]:
        return frozenset(e.strip().lower() for e in self.admin_emails.split(",") if e.strip())


settings = Settings()
