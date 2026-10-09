"""SQLAlchemy ORM models.

Files are never stored in the database. Only opaque storage keys and SHA-256 hashes are kept.
Deleting a user or original removes its rows through database cascades. The caller must also
delete the stored files, because the database cannot do that.
"""

import enum
from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, utcnow


class DocumentType(str, enum.Enum):
    PHOTO = "photo"
    SIGNATURE = "signature"
    THUMB = "thumb"
    MARKSHEET_10 = "marksheet_10"
    MARKSHEET_12 = "marksheet_12"
    GRADUATION = "graduation"
    OTHER = "other"


class OutputFormat(str, enum.Enum):
    JPEG = "jpeg"
    PNG = "png"
    PDF = "pdf"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("mobile IS NOT NULL OR email IS NOT NULL", name="ck_users_has_contact"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Normalized: 10 digits for mobile, lowercase for email. Either may be empty, but not both.
    mobile: Mapped[str | None] = mapped_column(String(10), unique=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True)
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    consent_accepted_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    originals: Mapped[list["OriginalDocument"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan", passive_deletes=True
    )
    derived_files: Mapped[list["DerivedFile"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan", passive_deletes=True
    )


class OtpCode(Base):
    """A one-time code. Only a keyed HMAC of the code is stored, never the code itself."""

    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    identifier: Mapped[str] = mapped_column(String(254), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime)


class OriginalDocument(Base):
    __tablename__ = "original_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    document_type: Mapped[str] = mapped_column(String(32))
    # Display name only. It is never used to build a filesystem path.
    original_filename: Mapped[str] = mapped_column(String(255))
    # Random UUID-based key, for example "originals/<hex>.jpg". Never overwritten.
    storage_key: Mapped[str] = mapped_column(String(100), unique=True)
    mime_type: Mapped[str] = mapped_column(String(32))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    width_px: Mapped[int | None] = mapped_column(Integer)
    height_px: Mapped[int | None] = mapped_column(Integer)
    page_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    owner: Mapped["User"] = relationship(back_populates="originals")
    derived_files: Mapped[list["DerivedFile"]] = relationship(
        back_populates="original", cascade="all, delete-orphan", passive_deletes=True
    )


class DerivedFile(Base):
    __tablename__ = "derived_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    original_id: Mapped[str] = mapped_column(
        ForeignKey("original_documents.id", ondelete="CASCADE"), index=True
    )
    profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("exam_profiles.id", ondelete="SET NULL")
    )
    document_type: Mapped[str] = mapped_column(String(32))
    storage_key: Mapped[str] = mapped_column(String(100), unique=True)
    output_format: Mapped[str] = mapped_column(String(16))
    mime_type: Mapped[str] = mapped_column(String(32))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    # Parameters the user asked for, and the report the engine returned (quality, dimensions, warnings).
    parameters: Mapped[dict] = mapped_column(JSON)
    report: Mapped[dict] = mapped_column(JSON)
    target_met: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)

    owner: Mapped["User"] = relationship(back_populates="derived_files")
    original: Mapped["OriginalDocument"] = relationship(back_populates="derived_files")


class ExamProfile(Base):
    """Output rules for one exam and document type.

    Seeded values are placeholders (is_placeholder=True) until checked against the official notification.
    """

    __tablename__ = "exam_profiles"
    __table_args__ = (
        CheckConstraint("max_kb > 0", name="ck_exam_profiles_max_kb_positive"),
        CheckConstraint("min_kb IS NULL OR min_kb <= max_kb", name="ck_exam_profiles_min_le_max"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    exam_name: Mapped[str] = mapped_column(String(100), index=True)
    post: Mapped[str | None] = mapped_column(String(150))
    document_type: Mapped[str] = mapped_column(String(32))
    max_kb: Mapped[int] = mapped_column(Integer)
    min_kb: Mapped[int | None] = mapped_column(Integer)
    output_format: Mapped[str] = mapped_column(String(16))
    width_px: Mapped[int | None] = mapped_column(Integer)
    height_px: Mapped[int | None] = mapped_column(Integer)
    dpi: Mapped[int | None] = mapped_column(Integer)
    background: Mapped[str] = mapped_column(String(32), default="white")
    notes: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str | None] = mapped_column(String(500))
    last_verified_on: Mapped[date | None] = mapped_column(Date)
    is_placeholder: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class ProcessingLog(Base):
    """Audit trail of actions. Holds no file contents and no personal data."""

    __tablename__ = "processing_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    original_id: Mapped[str | None] = mapped_column(
        ForeignKey("original_documents.id", ondelete="SET NULL")
    )
    derived_id: Mapped[str | None] = mapped_column(ForeignKey("derived_files.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(32))  # upload, process, download, delete
    status: Mapped[str] = mapped_column(String(16))  # ok, error
    detail: Mapped[str | None] = mapped_column(String(255))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
