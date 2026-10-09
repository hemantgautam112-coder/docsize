"""Builders for test images and PDFs. Plain functions, so tests can import them directly."""

import os
from io import BytesIO

from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter


def to_bytes(image: Image.Image, fmt: str, **save_kwargs) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format=fmt, **save_kwargs)
    return buffer.getvalue()


def make_photo_bytes(width: int = 900, height: int = 1100) -> bytes:
    """A smooth, colourful JPEG that compresses well."""
    image = Image.effect_mandelbrot((width, height), (-2.0, -1.5, 1.0, 1.5), 100).convert("RGB")
    return to_bytes(image, "JPEG", quality=95)


def make_noise_image(width: int, height: int) -> Image.Image:
    """Random RGB pixels. The hardest content to compress, so it is good for size-limit tests."""
    return Image.frombytes("RGB", (width, height), os.urandom(width * height * 3))


def make_text_pdf(pages: int = 1) -> bytes:
    """A small PDF with simple text on white pages. Its images are not downsampled by the engine."""
    writer = PdfWriter()
    for index in range(pages):
        image = Image.new("RGB", (612, 792), "white")
        ImageDraw.Draw(image).text((40, 40), f"Page {index + 1}", fill="black")
        writer.append(PdfReader(BytesIO(to_bytes(image, "PDF"))))
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def make_image_pdf(width: int = 1200, height: int = 1600) -> bytes:
    """A one-page PDF holding a large, incompressible image. Used to exercise PDF downsampling."""
    return to_bytes(make_noise_image(width, height), "PDF", resolution=200)
