"""Processed (derived) files: list, download, and delete. Owner only."""

import re

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_db,
    get_owned_derived,
    verify_csrf,
)
from app.models import DerivedFile, User
from app.schemas import DerivedOut
from app.services.audit import log_event
from app.services.derived import delete_derived, download_name, is_expired
from app.services.storage import get_storage

router = APIRouter(prefix="/derived", tags=["derived"])


def to_derived_out(row: DerivedFile) -> DerivedOut:
    return DerivedOut(
        id=row.id,
        original_id=row.original_id,
        document_type=row.document_type,
        output_format=row.output_format,
        mime_type=row.mime_type,
        size_bytes=row.size_bytes,
        sha256=row.sha256,
        target_met=row.target_met,
        report=row.report,
        parameters=row.parameters,
        created_at=row.created_at,
        expires_at=row.expires_at,
        download_name=download_name(row),
        download_path=f"/derived/{row.id}/file",
    )


@router.get("", response_model=list[DerivedOut])
def list_derived(
    original_id: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DerivedOut]:
    query = select(DerivedFile).where(DerivedFile.owner_id == user.id)
    if original_id is not None:
        query = query.where(DerivedFile.original_id == original_id)
    rows = db.scalars(query.order_by(DerivedFile.created_at.desc())).all()
    return [to_derived_out(row) for row in rows]


@router.get("/{derived_id}/file")
def download_derived(
    derived_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    row = get_owned_derived(db, derived_id, user)
    if is_expired(row):
        raise HTTPException(status_code=410, detail="This file has expired. Process the document again.")
    try:
        data = get_storage().read(row.storage_key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=410, detail="This file is no longer available. Process the document again.") from exc

    log_event(db, action="download", owner_id=user.id, original_id=row.original_id, derived_id=row.id)
    return Response(
        content=data,
        media_type=row.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{_ascii_filename(download_name(row))}"'},
    )


@router.delete("/{derived_id}", status_code=204, dependencies=[Depends(verify_csrf)])
def delete_derived_file(
    derived_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    row = get_owned_derived(db, derived_id, user)
    original_id = row.original_id
    delete_derived(db, row)
    log_event(db, action="delete", owner_id=user.id, original_id=original_id, detail="derived")
    return Response(status_code=204)


def _ascii_filename(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)
