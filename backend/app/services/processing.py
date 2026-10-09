"""Turns an exam profile plus optional overrides, or a custom request, into a ProcessingSpec.

Request values override the profile. Then the matching engine runs.
"""

from app.models import ExamProfile
from app.schemas import ProcessIn
from app.services.image_engine import process_image
from app.services.pdf_engine import process_pdf
from app.services.processing_common import EngineResult, ProcessingError, ProcessingSpec

CM_PER_INCH = 2.54
_DEFAULT_FORMAT = {"image": "jpeg", "pdf": "pdf"}


def _to_px(value: float | None, unit: str, dpi: int | None) -> int | None:
    if value is None:
        return None
    if unit == "cm":
        if dpi is None:
            raise ProcessingError("DPI is required when the size is given in cm.")
        return max(1, round(value / CM_PER_INCH * dpi))
    return max(1, round(value))


def resolve_spec(profile: ExamProfile | None, request: ProcessIn, kind: str) -> ProcessingSpec:
    """Build the final spec. `kind` is "image" or "pdf", taken from the original document."""
    if profile is not None and profile.background.lower() != "white":
        raise ProcessingError(
            f"{profile.exam_name} needs a {profile.background} background, which DocSize does not support yet."
        )

    target_kb = request.target_kb if request.target_kb is not None else (profile.max_kb if profile else None)
    if target_kb is None:
        raise ProcessingError("Enter a target size in KB.")

    min_kb = request.min_kb if request.min_kb is not None else (profile.min_kb if profile else None)
    output_format = request.output_format or (profile.output_format if profile else None) or _DEFAULT_FORMAT[kind]
    dpi = request.dpi if request.dpi is not None else (profile.dpi if profile else None)

    if request.width is not None or request.height is not None:
        # Explicit dimensions replace the profile's dimensions. A missing side follows the aspect ratio.
        width_px = _to_px(request.width, request.unit, dpi)
        height_px = _to_px(request.height, request.unit, dpi)
    else:
        width_px = profile.width_px if profile else None
        height_px = profile.height_px if profile else None

    return ProcessingSpec(
        target_kb=target_kb,
        output_format=output_format,
        min_kb=min_kb,
        width_px=width_px,
        height_px=height_px,
        dpi=dpi,
        background="white",
    )


def build_parameters(profile: ExamProfile | None, spec: ProcessingSpec) -> dict:
    """Snapshot of the parameters used. Stored with the derived file, and used to name the download."""
    return {
        "mode": "exam" if profile is not None else "custom",
        "profile_id": profile.id if profile is not None else None,
        "exam_name": profile.exam_name if profile is not None else None,
        "post": profile.post if profile is not None else None,
        "target_kb": spec.target_kb,
        "min_kb": spec.min_kb,
        "output_format": spec.output_format,
        "width_px": spec.width_px,
        "height_px": spec.height_px,
        "dpi": spec.dpi,
        "background": spec.background,
    }


def run_processing(data: bytes, kind: str, spec: ProcessingSpec) -> EngineResult:
    if kind == "pdf":
        if spec.output_format != "pdf":
            raise ProcessingError("PDF files can only be processed into PDF output.")
        return process_pdf(data, spec)
    if spec.output_format not in ("jpeg", "png"):
        raise ProcessingError("Photos and signatures can be saved as JPEG or PNG.")
    return process_image(data, spec)
