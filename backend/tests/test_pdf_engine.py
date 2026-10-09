"""Processing engine: PDF path."""

from io import BytesIO

import pytest
from pypdf import PdfReader

from app.services.pdf_engine import process_pdf
from app.services.processing_common import ProcessingError, ProcessingSpec
from tests.helpers import make_text_pdf


def _pages(data: bytes) -> int:
    return len(PdfReader(BytesIO(data)).pages)


def test_small_pdf_needs_only_lossless_cleanup():
    source = make_text_pdf(pages=2)

    result = process_pdf(source, ProcessingSpec(target_kb=500, output_format="pdf"))

    assert result.mime_type == "application/pdf"
    assert result.extension == "pdf"
    assert result.report["method"] == "lossless"
    assert result.report["target_met"] is True
    assert result.report["page_count"] == 2
    assert _pages(result.data) == 2


def test_large_image_pdf_is_downsampled_to_meet_target(pdf_bytes):
    result = process_pdf(pdf_bytes, ProcessingSpec(target_kb=150, output_format="pdf"))

    assert result.report["target_met"] is True
    assert len(result.data) <= 150 * 1024
    assert result.report["method"] == "downsampled"
    assert result.report["image_scale_percent"] is not None
    assert _pages(result.data) == 1


def test_unreachable_pdf_target_returns_best_result_with_warning(pdf_bytes):
    result = process_pdf(pdf_bytes, ProcessingSpec(target_kb=5, output_format="pdf"))

    assert result.report["target_met"] is False
    assert result.report["warnings"]
    assert _pages(result.data) == 1  # the returned file is still a valid PDF


def test_pdf_cannot_be_converted_to_jpeg(pdf_bytes):
    from app.services.processing import run_processing

    with pytest.raises(ProcessingError):
        run_processing(pdf_bytes, "pdf", ProcessingSpec(target_kb=100, output_format="jpeg"))
