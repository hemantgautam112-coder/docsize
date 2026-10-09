"""PDF processing.

Step 1 is lossless cleanup: compress content streams and drop duplicate objects.
Step 2, if still too large, downsamples embedded images and recompresses them as JPEG.
It tries higher resolution first, then lower quality, and returns the first result that fits.
If nothing fits, it returns the smallest result with target_met=False and a warning.
"""

from io import BytesIO

from PIL import Image
from pypdf import PdfReader, PdfWriter

from app.services.processing_common import (
    EXT_BY_FORMAT,
    MIME_BY_FORMAT,
    EngineResult,
    ProcessingError,
    ProcessingSpec,
)

SCALE_STEPS = (1.0, 0.85, 0.7, 0.6, 0.5, 0.4)
QUALITY_STEPS = (85, 70, 55, 40)
MIN_READABLE_SIDE_PX = 100
LOW_QUALITY_WARNING = 50


def process_pdf(data: bytes, spec: ProcessingSpec) -> EngineResult:
    try:
        reader = PdfReader(BytesIO(data))
        encrypted = reader.is_encrypted
        page_count = len(reader.pages)
    except Exception as exc:
        raise ProcessingError("This PDF could not be read. It may be damaged.") from exc
    if encrypted:
        raise ProcessingError("Password-protected PDFs are not supported. Remove the password first.")

    notes: list[str] = []
    warnings: list[str] = []
    if spec.width_px or spec.height_px:
        notes.append("Width and height are ignored for PDF files. Page layout is kept.")

    max_bytes = spec.target_kb * 1024
    lossless = _rewrite(data)
    if len(lossless) <= max_bytes:
        return _result(lossless, spec, page_count, "lossless", None, None, True, notes, warnings)

    smallest, smallest_setting = lossless, (None, None)
    for scale in SCALE_STEPS:
        for quality in QUALITY_STEPS:
            candidate = _rewrite(data, scale=scale, quality=quality)
            if len(candidate) <= max_bytes:
                return _result(candidate, spec, page_count, "downsampled", scale, quality, True, notes, warnings)
            if len(candidate) < len(smallest):
                smallest, smallest_setting = candidate, (scale, quality)

    scale, quality = smallest_setting
    method = "lossless" if scale is None else "downsampled"
    warnings.append(
        f"Could not reach {spec.target_kb} KB without making the document unreadable. "
        f"The smallest version is {len(smallest) / 1024:.1f} KB. Check the portal's limit."
    )
    return _result(smallest, spec, page_count, method, scale, quality, False, notes, warnings)


def _rewrite(data: bytes, scale: float | None = None, quality: int | None = None) -> bytes:
    """Rewrite the PDF. If scale is given, also downsample and recompress its embedded images."""
    writer = PdfWriter(clone_from=PdfReader(BytesIO(data)))
    for page in writer.pages:
        page.compress_content_streams()
        if scale is not None and quality is not None:
            for image in page.images:
                _recompress_image(image, scale, quality)
    writer.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)

    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def _recompress_image(image, scale: float, quality: int) -> None:
    try:
        if image.indirect_reference is None:
            return  # inline images are not replaceable
        raw = image.indirect_reference.get_object()
        if "/SMask" in raw or "/Mask" in raw:
            return  # transparency masks would no longer line up with the replaced image
        pil = image.image
        if pil is None:
            return
        if pil.mode not in ("RGB", "L"):
            pil = pil.convert("RGB")
        if scale < 1:
            new_size = (max(1, round(pil.width * scale)), max(1, round(pil.height * scale)))
            if min(new_size) >= MIN_READABLE_SIDE_PX:
                pil = pil.resize(new_size, resample=Image.Resampling.LANCZOS)
        image.replace(pil, quality=quality)
    except Exception:
        # An image pypdf cannot decode is left as it is. The rest of the document is still processed.
        return


def _result(
    data: bytes,
    spec: ProcessingSpec,
    page_count: int,
    method: str,
    scale: float | None,
    quality: int | None,
    fits: bool,
    notes: list[str],
    warnings: list[str],
) -> EngineResult:
    if scale is not None and scale < 1:
        notes.append(f"Embedded images were scaled to {round(scale * 100)}% and recompressed.")
    if quality is not None and quality < LOW_QUALITY_WARNING:
        warnings.append(f"Heavy compression was needed (image quality {quality}). Images may look soft.")

    report = {
        "method": method,
        "output_format": "pdf",
        "final_size_kb": round(len(data) / 1024, 2),
        "target_kb": spec.target_kb,
        "min_kb": spec.min_kb,
        "quality": quality,
        "image_scale_percent": round(scale * 100) if scale is not None else None,
        "page_count": page_count,
        "width_px": None,
        "height_px": None,
        "dpi": spec.dpi,
        "target_met": fits,
        "notes": notes,
        "warnings": warnings,
    }
    return EngineResult(
        data=data,
        mime_type=MIME_BY_FORMAT["pdf"],
        extension=EXT_BY_FORMAT["pdf"],
        report=report,
    )
