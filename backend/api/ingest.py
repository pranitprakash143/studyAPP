import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from parsers.router import route_file, route_youtube
from core.config import get_settings
from api.pending import mark_pending

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/ingest")
async def ingest(
    subject: str = Form(..., description="Subject name e.g. 'History'"),
    topic: str = Form(..., description="Topic/chapter name e.g. 'Mughal Empire'"),
    file: Optional[UploadFile] = File(None),
    pasted_text: Optional[str] = Form(None),
    youtube_url: Optional[str] = Form(None),
):
    """
    Ingest content into the Living Knowledge Base.

    Accepts one of:
    - `file`        — PDF, DOCX, PPTX, TXT, or image
    - `pasted_text` — Raw text pasted directly
    - `youtube_url` — YouTube URL for transcript extraction

    Returns immediately after parsing. Heavy processing (embeddings, wiki compilation)
    happens on-demand when the subject page is visited.
    """
    # ── 1. Validate inputs ────────────────────────────────────────────────────
    sources = sum(
        [
            file is not None,
            bool(pasted_text and pasted_text.strip()),
            bool(youtube_url and youtube_url.strip()),
        ]
    )
    if sources == 0:
        raise HTTPException(
            status_code=422,
            detail="Provide exactly one of: file, pasted_text, or youtube_url.",
        )
    if sources > 1:
        raise HTTPException(
            status_code=422,
            detail="Provide only ONE of: file, pasted_text, or youtube_url.",
        )

    # ── 2. Extract raw text (fast — parsing only) ────────────────────────────
    try:
        if file is not None:
            if not file.filename:
                raise ValueError("Uploaded file has no filename.")
            file_bytes = await file.read()
            if not file_bytes:
                raise ValueError("Uploaded file is empty.")
            raw_text, source_name = await route_file(file_bytes, file.filename)

        elif pasted_text:
            raw_text = pasted_text.strip()
            source_name = f"pasted_text_{subject}_{topic}".replace(" ", "_")

        else:  # youtube_url
            if not youtube_url:
                raise HTTPException(status_code=422, detail="YouTube URL is required.")
            raw_text, source_name = await route_youtube(youtube_url.strip())  # type: ignore[union-attr]

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"[Ingest] Parsing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to parse source: {e}")

    if not raw_text.strip():
        raise HTTPException(
            status_code=422, detail="Extracted text is empty — check the file quality."
        )

    # ── 2.5. Enforce max character limit ─────────────────────────────────────
    settings = get_settings()
    char_count = len(raw_text)
    if char_count > settings.max_ingest_chars:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Document is too large for high-quality ingestion. "
                f"Extracted {char_count:,} characters, but the maximum is {settings.max_ingest_chars:,}. "
                f"Please split your document into smaller sections (ideally under {settings.max_ingest_chars:,} characters / ~40 pages) "
                f"for optimal AI processing and note quality."
            ),
        )

    logger.info(
        f"[Ingest] Parsed {char_count:,} chars from '{source_name}' for {subject}/{topic}"
    )

    # ── 3. Mark as pending (heavy processing deferred) ───────────────────────
    entry_id = await mark_pending(
        subject=subject,
        topic=topic,
        source_name=source_name,
        raw_text=raw_text,
    )

    return {
        "success": True,
        "status": "pending",
        "message": f"Document parsed and queued for processing. Visit the subject page to trigger processing.",
        "entry_id": entry_id,
        "source": source_name,
        "subject": subject,
        "topic": topic,
    }
