"""Photo and signature processing.

Steps: fix EXIF orientation, flatten transparency onto white, drop all metadata, crop and resize,
then compress. JPEG uses a binary search on quality. If that is not enough, the image is shrunk
in steps, but never below MIN_READABLE_SIDE_PX.
"""

from io import BytesIO

from PIL import Image, ImageOps

from app.services.processing_common import (
    EXT_BY_FORMAT,
    MIME_BY_FORMAT,
    EngineResult,
    ProcessingSpec,
)

MIN_JPEG_QUALITY = 20
MAX_JPEG_QUALITY = 95
LOW_QUALITY_WARNING = 50
MAX_UPSCALE = 2.0
MIN_READABLE_SIDE_PX = 100
DOWNSCALE_STEP = 0.9


def process_image(data: bytes, spec: ProcessingSpec) -> EngineResult:
    notes: list[str] = []
    warnings: list[str] = []

    source = _normalize(data)
    source_width, source_height = source.size
    image = _crop_and_resize(source, spec, notes, warnings)

    size_before_shrink = image.size
    encode_best = _best_jpeg if spec.output_format == "jpeg" else _best_png
    encoded, level, fits, image = _shrink_to_fit(image, spec.target_kb * 1024, encode_best)
    if image.size != size_before_shrink:
        notes.append(f"Reduced to {image.width}x{image.height} px to fit the size limit.")

    final_kb = len(encoded) / 1024
    if not fits:
        warnings.append(
            f"Could not reach {spec.target_kb} KB without making the image unreadable. "
            f"The smallest version is {final_kb:.1f} KB. Use a sharper, simpler photo "
            "or check the portal's limit."
        )
    if level is not None and level < LOW_QUALITY_WARNING:
        warnings.append(f"Heavy compression was needed (quality {level}). Details may look soft.")
    if spec.min_kb and len(encoded) < spec.min_kb * 1024:
        warnings.append(f"The output is {final_kb:.1f} KB, below the minimum of {spec.min_kb} KB.")

    report = {
        "method": "image",
        "output_format": spec.output_format,
        "final_size_kb": round(final_kb, 2),
        "target_kb": spec.target_kb,
        "min_kb": spec.min_kb,
        "quality": level,
        "width_px": image.width,
        "height_px": image.height,
        "dpi": spec.dpi,
        "source_width_px": source_width,
        "source_height_px": source_height,
        "target_met": fits,
        "notes": notes,
        "warnings": warnings,
    }
    return EngineResult(
        data=encoded,
        mime_type=MIME_BY_FORMAT[spec.output_format],
        extension=EXT_BY_FORMAT[spec.output_format],
        report=report,
    )


def _normalize(data: bytes) -> Image.Image:
    """Return an RGB image with orientation applied, transparency flattened, and no metadata carried over."""
    with Image.open(BytesIO(data)) as raw:
        image = ImageOps.exif_transpose(raw)
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        white = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        white.alpha_composite(rgba)
        return white.convert("RGB")
    return image.convert("RGB")


def _crop_and_resize(
    image: Image.Image, spec: ProcessingSpec, notes: list[str], warnings: list[str]
) -> Image.Image:
    if spec.width_px is None and spec.height_px is None:
        return image

    src_w, src_h = image.size
    width = spec.width_px if spec.width_px is not None else max(1, round(spec.height_px * src_w / src_h))
    height = spec.height_px if spec.height_px is not None else max(1, round(spec.width_px * src_h / src_w))

    target_ratio = width / height
    if abs(src_w / src_h - target_ratio) > 0.01:
        if src_w / src_h > target_ratio:
            new_w = round(src_h * target_ratio)
            left = (src_w - new_w) // 2
            image = image.crop((left, 0, left + new_w, src_h))
        else:
            new_h = round(src_w / target_ratio)
            top = (src_h - new_h) // 2
            image = image.crop((0, top, src_w, top + new_h))
        notes.append("Cropped the centre of the image to match the required aspect ratio.")

    scale = width / image.width
    if scale > MAX_UPSCALE:
        width, height = round(image.width * MAX_UPSCALE), round(image.height * MAX_UPSCALE)
        warnings.append(
            f"The source image is too small for the requested size. It was enlarged only to "
            f"{width}x{height} px, which the portal may reject."
        )
    elif scale > 1:
        warnings.append(f"The source image was enlarged {scale:.1f}x, which can look blurry.")

    return image.resize((width, height), Image.Resampling.LANCZOS)


def _encode_jpeg(image: Image.Image, quality: int) -> bytes:
    buffer = BytesIO()
    # Only pixel data is written. No EXIF, ICC, or other metadata is passed to the encoder.
    image.save(buffer, format="JPEG", quality=quality, optimize=True)
    return buffer.getvalue()


def _encode_png(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def _best_jpeg(image: Image.Image, max_bytes: int) -> tuple[bytes, int, bool]:
    """Largest JPEG quality whose output fits. Returns (bytes, quality, fits)."""
    smallest = _encode_jpeg(image, MIN_JPEG_QUALITY)
    if len(smallest) > max_bytes:
        return smallest, MIN_JPEG_QUALITY, False

    best, best_quality = smallest, MIN_JPEG_QUALITY
    low, high = MIN_JPEG_QUALITY + 1, MAX_JPEG_QUALITY
    while low <= high:
        mid = (low + high) // 2
        candidate = _encode_jpeg(image, mid)
        if len(candidate) <= max_bytes:
            best, best_quality = candidate, mid
            low = mid + 1
        else:
            high = mid - 1
    return best, best_quality, True


def _best_png(image: Image.Image, max_bytes: int) -> tuple[bytes, None, bool]:
    """PNG is lossless, so try the full-colour version, then a 256-colour palette version."""
    best = min(_encode_png(image), _encode_png(image.quantize(colors=256)), key=len)
    return best, None, len(best) <= max_bytes


def _shrink_to_fit(image, max_bytes, encode_best):
    """Shrink in steps until the encoder fits the limit or the image would become unreadable."""
    while True:
        encoded, level, fits = encode_best(image, max_bytes)
        if fits:
            return encoded, level, True, image
        next_size = (round(image.width * DOWNSCALE_STEP), round(image.height * DOWNSCALE_STEP))
        if min(next_size) < MIN_READABLE_SIDE_PX:
            return encoded, level, False, image
        image = image.resize(next_size, Image.Resampling.LANCZOS)
