"""Input validators: uploaded guideline documents and advertisement images.

Content validation always inspects the actual bytes (magic bytes + decoding),
never just the client-supplied filename or content type.
"""
from __future__ import annotations

import io

from PIL import Image, ImageFile, UnidentifiedImageError
from pydantic import BaseModel

ImageFile.LOAD_TRUNCATED_IMAGES = False
Image.MAX_IMAGE_PIXELS = 80_000_000  # ~8000x8000; decompression-bomb guard

ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

ALLOWED_WORD_CONTENT_TYPES = {
    # .docx takes several content types in the wild
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",  # browsers often send this
}

ALLOWED_PDF_CONTENT_TYPES = {"application/pdf", "application/octet-stream"}
ALLOWED_TEXT_CONTENT_TYPES = {"text/plain", "application/octet-stream"}


class ImageValidationError(ValueError):
    """Raised with a safe, user-facing message — never raw file paths."""


class ValidatedImage(BaseModel):
    kind: str  # png | jpg | webp
    width: int
    height: int
    size_bytes: int


def validate_image_upload(
    *, data: bytes, filename: str, content_type: str, max_bytes: int, min_dim: int, max_dim: int
) -> ValidatedImage:
    """Validate an uploaded advertisement image by its actual bytes."""
    if not data:
        raise ImageValidationError("The uploaded image is empty.")
    if len(data) > max_bytes:
        limit_mb = max_bytes / (1024 * 1024)
        raise ImageValidationError(
            f"Image is too large ({len(data) / (1024 * 1024):.1f} MB). Limit is {limit_mb:.0f} MB."
        )

    try:
        with Image.open(io.BytesIO(data)) as img:
            img.load()
            fmt = (img.format or "").upper()
            width, height = img.size
            mode = img.mode
    except UnidentifiedImageError:
        raise ImageValidationError(
            "Unsupported or corrupted image. Please upload a PNG, JPEG or WebP file."
        )
    except Exception:
        raise ImageValidationError("The image could not be processed. Please try another file.")

    # Exact accepted formats — GIF/BMP/HEIC/etc. are rejected explicitly.
    if fmt not in ("PNG", "JPEG", "WEBP"):
        raise ImageValidationError(
            "Unsupported image format. Please upload a PNG, JPEG or WebP file."
        )

    if width < min_dim or height < min_dim:
        raise ImageValidationError(f"Image is too small ({width}x{height}). Minimum is {min_dim}px.")
    if width > max_dim or height > max_dim:
        raise ImageValidationError(
            f"Image is too large ({width}x{height}). Maximum is {max_dim}px on each side."
        )
    if mode not in ("RGB", "RGBA", "L"):
        raise ImageValidationError("Unsupported pixel format for the image.")

    kind = {"PNG": "png", "JPEG": "jpg", "WEBP": "webp"}[fmt]
    return ValidatedImage(kind=kind, width=width, height=height, size_bytes=len(data))


class DocumentValidationError(ValueError):
    """Raised with a safe, user-facing message."""


class ExtractedDocument(BaseModel):
    kind: str  # pdf | txt | docx
    text: str
    ok: bool
    note: str = ""


def validate_guideline_document(
    *, data: bytes, filename: str, content_type: str, max_bytes: int
) -> ExtractedDocument:
    """Validate + best-effort extract text from a brand-guideline document.

    This only snapshots the original material; AI-based structuring happens
    later in the brand_brain_service."""
    if not data:
        raise DocumentValidationError("The uploaded file is empty.")
    if len(data) > max_bytes:
        limit_mb = max_bytes / (1024 * 1024)
        raise DocumentValidationError(
            f"File is too large ({len(data) / (1024 * 1024):.1f} MB). Limit is {limit_mb:.0f} MB."
        )

    lower_name = filename.lower()
    head = data[:512]

    # --- PDF: magic bytes first, then real parse --------------------------------
    if head.startswith(b"%PDF") or lower_name.endswith(".pdf") and content_type in ALLOWED_PDF_CONTENT_TYPES:
        if not head.startswith(b"%PDF"):
            raise DocumentValidationError("The PDF file appears to be corrupted.")
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            if len(reader.pages) > 200:
                raise DocumentValidationError("PDF has too many pages (limit is 200).")
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
            text = text.strip()
            if not text:
                # Scan-only PDFs have no text layer; keep the file as original material.
                return ExtractedDocument(
                    kind="pdf",
                    text="",
                    ok=True,
                    note="No text layer found (scanned PDF). File stored as original material.",
                )
            return ExtractedDocument(kind="pdf", text=text, ok=True)
        except DocumentValidationError:
            raise
        except Exception:
            raise DocumentValidationError("The PDF could not be parsed. Please try another file.")

    # --- DOCX: real parse (zip requirement means corruption fails loudly) -------
    if lower_name.endswith(".docx") and content_type in ALLOWED_WORD_CONTENT_TYPES or (
        head.startswith(b"PK") and lower_name.endswith(".docx")
    ):
        try:
            import docx as pydocx

            doc = pydocx.Document(io.BytesIO(data))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            return ExtractedDocument(kind="docx", text=text.strip(), ok=True)
        except Exception:
            raise DocumentValidationError("The DOCX file could not be parsed.")

    # --- TXT --------------------------------------------------------------------
    if head.startswith(b"PK"):
        raise DocumentValidationError(
            "Only PDF, TXT and DOCX files are accepted. Rename DOCX files to .docx."
        )
    decoded = None
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            decoded = data.decode(encoding)
            break
        except (UnicodeDecodeError, ValueError):
            continue
    if decoded is None:
        raise DocumentValidationError(
            "Unsupported file. Please upload a PDF, TXT or DOCX brand guideline."
        )
    if "\x00" in decoded[:1000]:
        raise DocumentValidationError("Unsupported file type.")
    return ExtractedDocument(kind="txt", text=decoded.strip(), ok=True)
