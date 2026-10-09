"""Types and constants shared by the processing engines."""

from dataclasses import dataclass

from PIL import Image

from app.config import settings

# Decompression-bomb guard. Pillow only warns by default, so make oversize images an error.
Image.MAX_IMAGE_PIXELS = settings.max_image_pixels

MIME_BY_FORMAT = {"jpeg": "image/jpeg", "png": "image/png", "pdf": "application/pdf"}
EXT_BY_FORMAT = {"jpeg": "jpg", "png": "png", "pdf": "pdf"}


class ProcessingError(Exception):
    """A processing failure that is safe to show to the user."""


@dataclass(frozen=True)
class ProcessingSpec:
    target_kb: int
    output_format: str  # "jpeg" | "png" | "pdf"
    min_kb: int | None = None
    width_px: int | None = None
    height_px: int | None = None
    dpi: int | None = None
    background: str = "white"


@dataclass(frozen=True)
class EngineResult:
    data: bytes
    mime_type: str
    extension: str
    report: dict
