"""Processing engine: photo and signature path."""

from io import BytesIO

from PIL import Image

from app.services.image_engine import process_image
from app.services.processing_common import ProcessingSpec
from tests.helpers import make_noise_image, make_photo_bytes, to_bytes


def _open(data: bytes) -> Image.Image:
    return Image.open(BytesIO(data))


def test_jpeg_meets_target_and_requested_dimensions(photo_bytes):
    spec = ProcessingSpec(target_kb=200, output_format="jpeg", width_px=276, height_px=354, dpi=200)

    result = process_image(photo_bytes, spec)

    assert result.mime_type == "image/jpeg"
    assert result.extension == "jpg"
    assert len(result.data) <= 200 * 1024
    assert result.report["target_met"] is True
    assert (result.report["width_px"], result.report["height_px"]) == (276, 354)
    assert _open(result.data).format == "JPEG"


def test_target_is_never_exceeded_for_hard_content():
    spec = ProcessingSpec(target_kb=20, output_format="jpeg", width_px=276, height_px=354, dpi=200)

    result = process_image(make_photo_bytes(900, 1100), spec)

    if result.report["target_met"]:
        assert len(result.data) <= 20 * 1024
    else:
        assert result.report["warnings"], "an unmet target must come with a warning"


def test_exif_orientation_is_applied_and_metadata_removed():
    image = Image.new("RGB", (400, 200), (200, 30, 30))
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90 degrees clockwise when displayed
    exif[0x010F] = "Test camera"  # Make
    source = to_bytes(image, "JPEG", exif=exif.tobytes(), icc_profile=b"fake-profile")

    result = process_image(source, ProcessingSpec(target_kb=500, output_format="jpeg"))

    output = _open(result.data)
    assert output.size == (200, 400)
    assert len(output.getexif()) == 0
    assert "icc_profile" not in output.info
    assert "exif" not in output.info


def test_transparent_pixels_are_flattened_onto_white():
    transparent_png = to_bytes(Image.new("RGBA", (120, 120), (0, 0, 0, 0)), "PNG")

    result = process_image(transparent_png, ProcessingSpec(target_kb=200, output_format="jpeg"))

    pixel = _open(result.data).convert("RGB").getpixel((5, 5))
    assert all(channel >= 250 for channel in pixel), f"expected white, got {pixel}"


def test_upscaling_produces_a_warning():
    spec = ProcessingSpec(target_kb=200, output_format="jpeg", width_px=300, height_px=300)

    result = process_image(make_photo_bytes(100, 100), spec)

    assert any("enlarged" in warning for warning in result.report["warnings"])


def test_crop_to_requested_aspect_ratio(photo_bytes):
    spec = ProcessingSpec(target_kb=300, output_format="jpeg", width_px=200, height_px=100)

    result = process_image(photo_bytes, spec)

    assert (result.report["width_px"], result.report["height_px"]) == (200, 100)
    assert any("Cropped" in note for note in result.report["notes"])


def test_unreachable_target_returns_best_result_with_warning():
    noisy_png = to_bytes(make_noise_image(800, 800), "PNG")

    result = process_image(noisy_png, ProcessingSpec(target_kb=5, output_format="png"))

    assert result.report["target_met"] is False
    assert result.report["warnings"]
    assert result.report["width_px"] >= 100  # never shrunk below the readable minimum
    assert result.mime_type == "image/png"


def test_png_output_is_lossless_and_reports_no_quality():
    solid_png = to_bytes(Image.new("RGB", (200, 200), (10, 120, 200)), "PNG")

    result = process_image(solid_png, ProcessingSpec(target_kb=200, output_format="png"))

    assert result.report["quality"] is None
    assert result.report["target_met"] is True
    assert _open(result.data).convert("RGB").getpixel((50, 50)) == (10, 120, 200)
