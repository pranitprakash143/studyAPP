# ─────────────────────────────────────────────────────────────────────────────
# backend/parsers/pdf_parser.py
# Lightweight PDF parsing using pypdf + pdfminer.six.
#
# Phase 1: Pure text extraction — fast, no ML, no PyTorch dependency.
# Phase 2 plan: Swap in Docling for layout-aware parsing (tables, columns).
# ─────────────────────────────────────────────────────────────────────────────
import io
import logging
import re

logger = logging.getLogger(__name__)


async def parse_pdf(file_bytes: bytes, filename: str) -> str:
    """
    Parse a PDF file into clean text using pypdf (primary) + pdfminer (fallback).

    - pypdf: fast, good for digitally-born PDFs with embedded text.
    - pdfminer.six: better layout analysis for complex multi-column PDFs.
    - Raises ValueError if both extractors return empty text (likely scanned image PDF).
    """
    text = await _pypdf_extract(file_bytes, filename)

    if not text.strip() or len(text.strip()) < 50:
        logger.warning(f"[PDF Parser] pypdf returned sparse text, trying pdfminer…")
        text = await _pdfminer_extract(file_bytes, filename)

    if not text.strip():
        raise ValueError(
            f"Could not extract text from '{filename}'. "
            "The PDF may be a scanned image. "
            "Please use the Image upload option or paste the text manually."
        )

    # Basic cleanup: collapse excessive whitespace and fix broken hyphenation
    text = _clean_extracted_text(text)
    logger.info(f"[PDF Parser] Extracted {len(text)} chars from '{filename}'")
    return text


async def _pypdf_extract(file_bytes: bytes, filename: str) -> str:
    """Extract text using pypdf."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            pages.append(page_text)
        return "\n\n".join(pages)
    except Exception as e:
        logger.warning(f"[PDF Parser] pypdf failed for '{filename}': {e}")
        return ""


async def _pdfminer_extract(file_bytes: bytes, filename: str) -> str:
    """Extract text using pdfminer.six — better for complex layouts."""
    try:
        from pdfminer.high_level import extract_text
        text = extract_text(io.BytesIO(file_bytes))
        return text or ""
    except Exception as e:
        logger.warning(f"[PDF Parser] pdfminer failed for '{filename}': {e}")
        return ""


def _clean_extracted_text(text: str) -> str:
    """Clean common PDF extraction artifacts."""
    # Fix broken hyphenation (word- \n continuation)
    text = re.sub(r"-\n(\w)", r"\1", text)
    # Collapse multiple blank lines → single blank line
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove null bytes and control characters (except tab/newline)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text.strip()
