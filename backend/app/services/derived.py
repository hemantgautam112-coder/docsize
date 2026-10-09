"""Derived (processed) files: storage, retention, and download names."""

import re
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import utcnow
from app.models import DerivedFile, OriginalDocument, User
from app.services.processing_common import EngineResult
from app.services.storage import get_storage, sha256_hex


def store_derived(
    db: Session,
    *,
    owner: User,
    original: OriginalDocument,
    profile_id: int | None,
    result: EngineResult,
    parameters: dict,
) -> DerivedFile:
    storage = get_storage()
    key = storage.save(result.data, namespace="derived", extension=result.extension)
    now = utcnow()
    try:
        row = DerivedFile(
            owner_id=owner.id,
            original_id=original.id,
            profile_id=profile_id,
            document_type=original.document_type,
            storage_key=key,
            output_format=parameters["output_format"],
            mime_type=result.mime_type,
            size_bytes=len(result.data),
            sha256=sha256_hex(result.data),
            parameters=parameters,
            report=result.report,
            target_met=result.report["target_met"],
            created_at=now,
            expires_at=now + timedelta(days=settings.derived_retention_days),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    except Exception:
        db.rollback()
        storage.delete(key)
        raise
    return row


def is_expired(row: DerivedFile) -> bool:
    return row.expires_at <= utcnow()


def download_name(row: DerivedFile) -> str:
    """Example: photo_SSC_CGL_20KB.jpg"""
    label = re.sub(r"[^A-Za-z0-9]+", "_", row.parameters.get("exam_name") or "custom").strip("_")
    extension = row.storage_key.rsplit(".", 1)[1]
    return f"{row.document_type}_{label}_{row.parameters['target_kb']}KB.{extension}"


def delete_derived(db: Session, row: DerivedFile) -> None:
    key = row.storage_key
    db.delete(row)
    db.commit()
    get_storage().delete(key)


def purge_expired_derived(db: Session) -> int:
    """Delete derived files past their expiry. Used by the cleanup script. Returns the number deleted."""
    rows = db.scalars(select(DerivedFile).where(DerivedFile.expires_at <= utcnow())).all()
    keys = [row.storage_key for row in rows]
    for row in rows:
        db.delete(row)
    db.commit()
    storage = get_storage()
    for key in keys:
        storage.delete(key)
    return len(keys)
