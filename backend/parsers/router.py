# ─────────────────────────────────────────────────────────────────────────────
# backend/parsers/router.py
# MIME-type dispatcher: selects the correct parser for each upload type.
# ─────────────────────────────────────────────────────────────────────────────
import logging
import magic  # python-magic — detects MIME type from file bytes

from parsers.pdf_parser import parse_pdf
from parsers.docx_parser import parse_docx
from parsers.image_parser import parse_image
from parsers.youtube_parser import parse_youtube

logger = logging.getLogger(__name__)

# Accepted MIME types and their parser keys
MIME_TO_PARSER: dict[str, str] = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/msword": "docx",
    "text/plain": "text",
    "text/markdown": "text",
    "image/jpeg": "image",
    "image/png": "image",
    "image/webp": "image",
    "image/gif": "image",
    "image/tiff": "image",
}


async def route_file(file_bytes: bytes, filename: str) -> tuple[str, str]:
    """
    Detect file MIME type and route to the correct parser.

    Returns:
        (raw_text, source_name) tuple
    """
    # Detect MIME from bytes (more reliable than file extension)
    detected_mime = magic.from_buffer(file_bytes[:2048], mime=True)
    logger.info(f"[Parser Router] {filename} → detected MIME: {detected_mime}")

    parser_key = MIME_TO_PARSER.get(detected_mime)

    if parser_key is None:
        # Fallback: try by extension
        ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
        ext_map = {"pdf": "pdf", "docx": "docx", "doc": "docx", "pptx": "pptx",
                   "txt": "text", "md": "text", "png": "image", "jpg": "image",
                   "jpeg": "image", "webp": "image"}
        parser_key = ext_map.get(ext)

    if parser_key is None:
        raise ValueError(
            f"Unsupported file type: '{detected_mime}' (file: {filename}). "
            f"Accepted types: PDF, DOCX, PPTX, TXT, PNG, JPG, WebP."
        )

    if parser_key == "pdf":
        text = await parse_pdf(file_bytes, filename)
    elif parser_key in ("docx", "pptx"):
        text = await parse_docx(file_bytes, filename)
    elif parser_key == "image":
        text = await parse_image(file_bytes, detected_mime, filename)
    elif parser_key == "text":
        text = file_bytes.decode("utf-8", errors="replace")
    else:
        raise ValueError(f"No parser implemented for key: {parser_key}")

    return text, filename


async def route_youtube(url: str) -> tuple[str, str]:
    """Delegate to the YouTube transcript parser."""
    return await parse_youtube(url)
