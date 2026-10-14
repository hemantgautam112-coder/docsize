"""Original documents: upload, list, read, delete, and process into derived files. Owner only."""

import re
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import (
    get_current_user,
    get_db,
    get_owned_original,
    rate_limit_by_user,
    verify_csrf,
)
from app.config import settings
from app.models import DocumentType, ExamProfile, OriginalDocument, User
from app.schemas import DerivedOut, DocumentOut, DocumentUpdate, ProcessIn
from app.api.derived import to_derived_out
from app.services.audit import log_event
from app.services.derived import store_derived
from app.services.documents import (
    IntegrityCheckError,
    UnsupportedFileError,
    create_original,
    delete_original,
    read_verified_original,
)
from app.services.processing import build_parameters, resolve_spec, run_processing
from app.services.documents import image_to_pdf
from app.services.processing_common import ProcessingError

router = APIRouter(prefix="/documents", tags=["documents"])

_HOUR_SECONDS = 3600
_OVERSIZE_PROBE_BYTES = 1  # read one byte past the limit so oversize files are detected


@router.post(
    "",
    response_model=DocumentOut,
    status_code=201,
    dependencies=[
        Depends(verify_csrf),
        Depends(rate_limit_by_user("upload", settings.uploads_per_hour, _HOUR_SECONDS)),
    ],
)
async def upload_document(
    file: UploadFile = File(...),
    document_type: DocumentType = Form(...),
    convert_to_pdf: bool = Form(False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OriginalDocument:
    data = await file.read(settings.max_upload_bytes + _OVERSIZE_PROBE_BYTES)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"This file is larger than {settings.max_upload_mb} MB. Compress it and try again.",
        )
    if not data:
        raise HTTPException(status_code=422, detail="The file is empty.")

    try:
        if convert_to_pdf:
            # A scanned photo saved as a one-page PDF (for example, from the Scan button).
            data = await run_in_threadpool(image_to_pdf, data)
        doc = await run_in_threadpool(
            create_original, db, user, document_type.value, file.filename or "upload", data
        )
    except UnsupportedFileError as exc:
        log_event(db, action="upload", status="rejected", owner_id=user.id, detail="unsupported file")
        raise HTTPException(status_code=415, detail=str(exc)) from exc

    log_event(db, action="upload", owner_id=user.id, original_id=doc.id, detail=document_type.value)
    return doc


@router.get("", response_model=list[DocumentOut])
def list_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[OriginalDocument]:
    query = select(OriginalDocument).where(OriginalDocument.owner_id == user.id)
    return list(db.scalars(query.order_by(OriginalDocument.created_at.desc())).all())


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OriginalDocument:
    return get_owned_original(db, document_id, user)


@router.patch("/{document_id}", response_model=DocumentOut, dependencies=[Depends(verify_csrf)])
def update_document(
    document_id: str,
    body: DocumentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OriginalDocument:
    """Changes a file's tag (document type). The file itself is not changed."""
    doc = get_owned_original(db, document_id, user)
    doc.document_type = body.document_type.value
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{document_id}/file")
def download_original(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    doc = get_owned_original(db, document_id, user)
    try:
        data = read_verified_original(doc)
    except IntegrityCheckError as exc:
        log_event(db, action="download", status="error", owner_id=user.id, original_id=doc.id, detail="integrity")
        raise HTTPException(status_code=500, detail="The stored file failed an integrity check.") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=410, detail="The stored file is missing. Upload it again.") from exc

    return Response(
        content=data,
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{_ascii_filename(doc.original_filename)}"'},
    )


@router.delete("/{document_id}", status_code=204, dependencies=[Depends(verify_csrf)])
def delete_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    doc = get_owned_original(db, document_id, user)
    delete_original(db, doc)
    log_event(db, action="delete", owner_id=user.id, detail="original")
    return Response(status_code=204)


@router.post(
    "/{document_id}/process",
    response_model=DerivedOut,
    status_code=201,
    dependencies=[
        Depends(verify_csrf),
        Depends(rate_limit_by_user("process", settings.processes_per_hour, _HOUR_SECONDS)),
    ],
)
def process_document(
    document_id: str,
    body: ProcessIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DerivedOut:
    started = time.perf_counter()
    doc = get_owned_original(db, document_id, user)
    kind = "pdf" if doc.mime_type == "application/pdf" else "image"

    profile: ExamProfile | None = None
    if body.profile_id is not None:
        profile = db.get(ExamProfile, body.profile_id)
        if profile is None:
            raise HTTPException(status_code=404, detail="Exam profile not found.")
        if profile.document_type != doc.document_type:
            raise HTTPException(
                status_code=422,
                detail=f"This exam profile is for {_label(profile.document_type)}, but this document is {_label(doc.document_type)}.",
            )

    try:
        spec = resolve_spec(profile, body, kind)
        data = read_verified_original(doc)
        result = run_processing(data, kind, spec)
    except ProcessingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except IntegrityCheckError as exc:
        log_event(db, action="process", status="error", owner_id=user.id, original_id=doc.id, detail="integrity")
        raise HTTPException(status_code=500, detail="The stored file failed an integrity check. Upload it again.") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=410, detail="The stored file is missing. Upload it again.") from exc

    row = store_derived(
        db,
        owner=user,
        original=doc,
        profile_id=profile.id if profile is not None else None,
        result=result,
        parameters=build_parameters(profile, spec),
    )
    log_event(
        db,
        action="process",
        owner_id=user.id,
        original_id=doc.id,
        derived_id=row.id,
        detail="target_met" if row.target_met else "target_not_met",
        duration_ms=int((time.perf_counter() - started) * 1000),
    )
    return to_derived_out(row)


def _label(document_type: str) -> str:
    return document_type.replace("_", " ")


def _ascii_filename(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)
