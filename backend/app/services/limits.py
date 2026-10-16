"""Daily limits for brand-new accounts. They slow down bulk accounts without affecting long-standing users."""

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import utcnow
from app.models import User


def enforce_new_account_daily_limit(db: Session, user: User, model, limit: int, action: str) -> None:
    """Raises 429 when a new account has used its daily allowance. `model` has owner_id and created_at columns."""
    now = utcnow()
    if now - user.created_at >= timedelta(hours=settings.new_account_window_hours):
        return
    used_today = db.scalar(
        select(func.count())
        .select_from(model)
        .where(model.owner_id == user.id, model.created_at >= now - timedelta(hours=24))
    )
    if (used_today or 0) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"New accounts can {action} {limit} files a day. Your limit resets within 24 hours.",
        )
