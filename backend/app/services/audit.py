"""Audit trail writes. Entries hold only action names, IDs, and short codes. Never file contents or personal data."""

from sqlalchemy.orm import Session

from app.models import ProcessingLog


def log_event(
    db: Session,
    *,
    action: str,
    status: str = "ok",
    owner_id: int | None = None,
    original_id: str | None = None,
    derived_id: str | None = None,
    detail: str | None = None,
    duration_ms: int | None = None,
) -> None:
    db.add(
        ProcessingLog(
            owner_id=owner_id,
            original_id=original_id,
            derived_id=derived_id,
            action=action,
            status=status,
            detail=detail[:255] if detail else None,
            duration_ms=duration_ms,
        )
    )
    db.commit()
