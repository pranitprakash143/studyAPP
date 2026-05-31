# ─────────────────────────────────────────────────────────────────────────────
# backend/parsers/image_parser.py
# Image OCR: Gemini Vision (cloud) or Tesseract (local fallback).
# ─────────────────────────────────────────────────────────────────────────────
import base64
import logging

logger = logging.getLogger(__name__)


async def parse_image(file_bytes: bytes, mime_type: str, filename: str) -> str:
    """
    Extract text from an image using OCR.

    Cloud mode  → Gemini Vision API (handles handwritten notes beautifully)
    Local mode  → pytesseract (must be installed with Tesseract binary)
    """
    from core.config import get_settings
    settings = get_settings()

    if settings.ai_provider == "cloud" and settings.gemini_api_key:
        return await _gemini_ocr(file_bytes, mime_type, settings.gemini_api_key, settings.gemini_model)
    else:
        return await _tesseract_ocr(file_bytes)


async def _gemini_ocr(file_bytes: bytes, mime_type: str, api_key: str, model: str) -> str:
    """Send image to Gemini for multimodal OCR."""
    import httpx

    b64 = base64.b64encode(file_bytes).decode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    payload = {
        "contents": [{
            "parts": [
                {"text": (
                    "You are an expert OCR engine. Carefully read this image "
                    "and transcribe ALL visible text exactly as it appears. "
                    "Maintain original formatting, headings, bullet points, and tables. "
                    "Output ONLY the transcribed text with no commentary."
                )},
                {"inlineData": {"mimeType": mime_type, "data": b64}},
            ]
        }]
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    logger.info(f"[Image Parser] Gemini OCR extracted {len(text)} chars")
    return text


async def _tesseract_ocr(file_bytes: bytes) -> str:
    """Local OCR using pytesseract (requires Tesseract binary in PATH)."""
    try:
        import pytesseract
        from PIL import Image
        import io

        image = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(image, lang="eng")
        logger.info(f"[Image Parser] Tesseract extracted {len(text)} chars")
        return text
    except ImportError:
        raise RuntimeError(
            "pytesseract not installed. "
            "Set AI_PROVIDER=cloud with a valid GEMINI_API_KEY for image OCR."
        )
