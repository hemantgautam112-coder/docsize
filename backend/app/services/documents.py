"""Upload validation and storage for original documents.

Type detection uses magic bytes, then a real parse (Pillow or pypdf), so a renamed file is rejected.
Originals are written once and never modified. Their SHA-256 is checked on every read.
"""

import re
from dataclasses import dataclass
from io import BytesIO

from PIL import Image
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.config import settings
from app.db import utcnow
from app.models import OriginalDocument, User
from app.services.image_engine import _normalize
from app.services.storage import get_storage, sha256_hex

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_JPEG_SIGNATURE = b"\xff\xd8\xff"
_PDF_SIGNATURE = b"%PDF-"
_EXIF_ORIENTATION_TAG = 0x0112
_ROTATED_ORIENTATIONS = {5, 6, 7, 8}


class UnsupportedFileError(Exception):
    """Upload rejected. The message is safe to show to the user."""


class IntegrityCheckError(Exception):
    """A stored original no longer matches the hash recorded at upload."""


@dataclass(frozen=True)
class UploadInfo:
    mime_type: str
    extension: str
    width_px: int | None
    height_px: int | None
    page_count: int | None


def inspect_upload(data: bytes) -> UploadInfo:
    if data.startswith(_PDF_SIGNATURE):
        return _inspect_pdf(data)
    if data.startswith(_JPEG_SIGNATURE):
        return _inspect_image(data, "JPEG", "image/jpeg", "jpg")
    if data.startswith(_PNG_SIGNATURE):
        return _inspect_image(data, "PNG", "image/png", "png")
    raise UnsupportedFileError("Only JPG, PNG, or PDF files can be uploaded.")


def _inspect_image(data: bytes, expected_format: str, mime_type: str, extension: str) -> UploadInfo:
    try:
        with Image.open(BytesIO(data)) as probe:
            probe.verify()
        with Image.open(BytesIO(data)) as image:
            if image.format != expected_format:
                raise UnsupportedFileError("This file is not a valid image.")
            width, height = image.size
            orientation = image.getexif().get(_EXIF_ORIENTATION_TAG, 1)
    except UnsupportedFileError:
        raise
    except Exception as exc:
        raise UnsupportedFileError("This image is damaged or cannot be read.") from exc

    # Report the size as the user will see it, after EXIF rotation.
    if orientation in _ROTATED_ORIENTATIONS:
        width, height = height, width
    return UploadInfo(mime_type, extension, width, height, None)


def _inspect_pdf(data: bytes) -> UploadInfo:
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise UnsupportedFileError("Password-protected PDFs are not supported. Remove the password and upload again.")
        page_count = len(reader.pages)
    except UnsupportedFileError:
        raise
    except Exception as exc:
        raise UnsupportedFileError("This PDF is damaged or cannot be read.") from exc

    if page_count == 0:
        raise UnsupportedFileError("This PDF has no pages.")
    if page_count > settings.max_pdf_pages:
        raise UnsupportedFileError(f"PDFs can have at most {settings.max_pdf_pages} pages.")
    return UploadInfo("application/pdf", "pdf", None, None, page_count)


def image_to_pdf(data: bytes) -> bytes:
    """Turns a scanned photo into a one-page PDF. Orientation is fixed, transparency is flattened onto white,
    and no metadata is copied into the PDF."""
    try:
        image = _normalize(data)
    except Exception as exc:
        raise UnsupportedFileError("This picture could not be read. Please scan it again.") from exc
    buffer = BytesIO()
    image.save(buffer, format="PDF", resolution=200, quality=90)
    return buffer.getvalue()


def sanitize_filename(name: str | None) -> str:
    """Keep only the base name, without control characters. Used for display and download names."""
    base = (name or "upload").replace("\\", "/").split("/")[-1]
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip()[:255]
    return base or "upload"


def create_original(db: Session, owner: User, document_type: str, filename: str, data: bytes) -> OriginalDocument:
    info = inspect_upload(data)
    storage = get_storage()
    key = storage.save(data, namespace="originals", extension=info.extension)
    try:
        doc = OriginalDocument(
            owner_id=owner.id,
            document_type=document_type,
            original_filename=sanitize_filename(filename),
            storage_key=key,
            mime_type=info.mime_type,
            size_bytes=len(data),
            sha256=sha256_hex(data),
            width_px=info.width_px,
            height_px=info.height_px,
            page_count=info.page_count,
            created_at=utcnow(),
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
    except Exception:
        db.rollback()
        storage.delete(key)
        raise
    return doc


def read_verified_original(doc: OriginalDocument) -> bytes:
    data = get_storage().read(doc.storage_key)
    if sha256_hex(data) != doc.sha256:
        raise IntegrityCheckError(f"Original {doc.id} failed its SHA-256 check.")
    return data


def delete_original(db: Session, doc: OriginalDocument) -> None:
    """Delete the original and its derived files. Rows go first, then files, so no row points at a missing file."""
    keys = [doc.storage_key] + [derived.storage_key for derived in doc.derived_files]
    db.delete(doc)
    db.commit()
    storage = get_storage()
    for key in keys:
        storage.delete(key)
