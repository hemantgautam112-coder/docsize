"""The exam profile loader: the data file is valid, and running it twice does not duplicate profiles."""

import json
from pathlib import Path

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import ExamProfile
from scripts.seed_profiles import seed_profiles

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "exam_profiles.json"


def _entries() -> list[dict]:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))["profiles"]


def test_data_file_is_valid_and_has_verified_signature_profile():
    entries = _entries()

    assert entries, "the data file should contain at least one profile"
    with SessionLocal() as db:
        added, updated = seed_profiles(db, entries)
    assert added + updated == len(entries)

    with SessionLocal() as db:
        signature = db.scalar(select(ExamProfile).where(ExamProfile.document_type == "signature"))
        assert signature is not None
        assert (signature.min_kb, signature.max_kb) == (30, 49)
        assert signature.output_format == "jpeg"
        assert signature.is_placeholder is False


def test_running_the_loader_twice_updates_instead_of_duplicating():
    entries = _entries()
    with SessionLocal() as db:
        seed_profiles(db, entries)
        first_count = db.scalar(select(func.count()).select_from(ExamProfile))

    with SessionLocal() as db:
        added, updated = seed_profiles(db, entries)
        second_count = db.scalar(select(func.count()).select_from(ExamProfile))

    assert added == 0
    assert updated == len(entries)
    assert first_count == second_count
