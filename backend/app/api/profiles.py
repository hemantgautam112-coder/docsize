"""Exam profiles. Reads are public. Writes are admin-only. Seeded values are placeholders until verified."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin, verify_csrf
from app.models import DocumentType, ExamProfile, User
from app.schemas import ProfileIn, ProfileOut

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfileOut])
def list_profiles(document_type: DocumentType | None = None, db: Session = Depends(get_db)) -> list[ExamProfile]:
    query = select(ExamProfile).order_by(ExamProfile.exam_name, ExamProfile.document_type, ExamProfile.post)
    if document_type is not None:
        query = query.where(ExamProfile.document_type == document_type.value)
    return list(db.scalars(query).all())


@router.get("/{profile_id}", response_model=ProfileOut)
def get_profile(profile_id: int, db: Session = Depends(get_db)) -> ExamProfile:
    return _get_or_404(db, profile_id)


@router.post(
    "",
    response_model=ProfileOut,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_profile(body: ProfileIn, _admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> ExamProfile:
    profile = ExamProfile(**_profile_fields(body))
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/{profile_id}", response_model=ProfileOut, dependencies=[Depends(verify_csrf)])
def update_profile(
    profile_id: int,
    body: ProfileIn,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ExamProfile:
    profile = _get_or_404(db, profile_id)
    for field, value in _profile_fields(body).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


def _get_or_404(db: Session, profile_id: int) -> ExamProfile:
    profile = db.get(ExamProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Exam profile not found.")
    return profile


def _profile_fields(body: ProfileIn) -> dict:
    fields = body.model_dump()
    fields["document_type"] = body.document_type.value
    fields["output_format"] = body.output_format.value
    return fields
