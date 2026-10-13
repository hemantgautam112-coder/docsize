"""Loads exam profiles from data/exam_profiles.json into the database.

Running it again updates existing profiles, so the JSON file stays the single source of truth.
Only counts are printed.

Inside the API container:  python scripts/seed_profiles.py
"""

import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import ExamProfile
from app.schemas import ProfileIn

# In the container the data folder is mounted at /app/data. On a development PC it is the project's data folder.
CANDIDATE_PATHS = [
    Path("/app/data/exam_profiles.json"),
    Path(__file__).resolve().parents[2] / "data" / "exam_profiles.json",
]


def find_profiles_file() -> Path:
    for path in CANDIDATE_PATHS:
        if path.is_file():
            return path
    raise FileNotFoundError("data/exam_profiles.json was not found.")


def seed_profiles(db: Session, entries: list[dict]) -> tuple[int, int]:
    """Adds or updates each profile. Returns (added, updated). Raises if any entry is invalid."""
    added = updated = 0
    for entry in entries:
        profile_in = ProfileIn.model_validate(entry)
        fields = profile_in.model_dump()
        fields["document_type"] = profile_in.document_type.value
        fields["output_format"] = profile_in.output_format.value

        post_match = ExamProfile.post.is_(None) if fields["post"] is None else ExamProfile.post == fields["post"]
        existing = db.scalar(
            select(ExamProfile).where(
                ExamProfile.exam_name == fields["exam_name"],
                post_match,
                ExamProfile.document_type == fields["document_type"],
            )
        )
        if existing is None:
            db.add(ExamProfile(**fields))
            added += 1
        else:
            for name, value in fields.items():
                setattr(existing, name, value)
            updated += 1
    db.commit()
    return added, updated


def main() -> None:
    path = find_profiles_file()
    entries = json.loads(path.read_text(encoding="utf-8"))["profiles"]
    with SessionLocal() as db:
        added, updated = seed_profiles(db, entries)
    print(f"Profiles from {path.name}: {added} added, {updated} updated.")


if __name__ == "__main__":
    main()
