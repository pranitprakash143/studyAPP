# ─────────────────────────────────────────────────────────────────────────────
# backend/parsers/image_parser.py
# Image OCR: Gemini Vision, OpenAI Vision, or Tesseract (local fallback).
# ─────────────────────────────────────────────────────────────────────────────
import base64
import logging

logger = logging.getLogger(__name__)


async def parse_image(file_bytes: bytes, mime_type: str, filename: str) -> str:
    """
    Extract text from an image using OCR.

    OpenAI mode → OpenAI Vision API (gpt-4o / gpt-4o-mini)
    Cloud mode  → Gemini Vision API (handles handwritten notes beautifully)
    Local mode  → pytesseract (must be installed with Tesseract binary)
    """
    from core.llm import get_resolved_ai_config
    config = get_resolved_ai_config()
    provider = config["provider"]

    if provider == "openai":
        if config["openai_key"]:
            # Ensure model has vision capabilities; gpt-4o or gpt-4o-mini do
            vision_model = config["openai_model"]
            if "gpt" not in vision_model:
                vision_model = "gpt-4o-mini"
            return await _openai_ocr(file_bytes, mime_type, config["openai_key"], vision_model)
    elif provider == "cloud" or provider == "google":
        if config["gemini_key"]:
            return await _gemini_ocr(file_bytes, mime_type, config["gemini_key"], config["gemini_model"])
            
    # Default local fallback
    return await _tesseract_ocr(file_bytes)


async def _openai_ocr(file_bytes: bytes, mime_type: str, api_key: str, model: str) -> str:
    """Send image to OpenAI for multimodal OCR."""
    import httpx

    b64 = base64.b64encode(file_bytes).decode()
    url = "https://api.openai.com/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "You are an expert OCR engine. Carefully read this image "
                            "and transcribe ALL visible text exactly as it appears. "
                            "Maintain original formatting, headings, bullet points, and tables. "
                            "Output ONLY the transcribed text with no commentary."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{b64}"
                        }
                    }
                ]
            }
        ],
        "temperature": 0.0
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    logger.info(f"[Image Parser] OpenAI OCR extracted {len(text)} chars using {model}")
    return text


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
            "Set AI_PROVIDER=cloud/openai with a valid API key for image OCR."
        )
