"""Database engine, session factory, and declarative base.

Works with SQLite (development default) and PostgreSQL via DATABASE_URL.
"""

from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


def utcnow() -> datetime:
    """Current time as naive UTC. SQLite drops tzinfo, so timestamps are stored naive UTC everywhere."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


def _make_engine(url: str) -> Engine:
    parsed = make_url(url)
    is_sqlite = parsed.get_backend_name() == "sqlite"

    connect_args: dict = {}
    if is_sqlite:
        connect_args["check_same_thread"] = False
        if parsed.database and parsed.database != ":memory:":
            Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True)

    if is_sqlite:
        # SQLite ignores foreign keys unless this is enabled per connection.
        @event.listens_for(engine, "connect")
        def _enable_sqlite_foreign_keys(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


engine = _make_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create any missing tables. Does not alter existing tables; use Alembic for schema changes later."""
    from app import models  # noqa: F401  (registers all models on Base.metadata)

    Base.metadata.create_all(bind=engine)
