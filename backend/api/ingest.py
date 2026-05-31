# ─────────────────────────────────────────────────────────────────────────────
# backend/api/ingest.py
# POST /api/ingest — handles file uploads, text pastes, and YouTube URLs.
# Routes to the appropriate parser, then runs the LangGraph ingestion pipeline.
# ─────────────────────────────────────────────────────────────────────────────
import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.responses import JSONResponse

from parsers.router import route_file, route_youtube
from graphs.ingestion_graph import run_ingestion

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
    """
    # ── 1. Validate inputs ────────────────────────────────────────────────────
    sources = sum([
        file is not None,
        bool(pasted_text and pasted_text.strip()),
        bool(youtube_url and youtube_url.strip()),
    ])
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

    # ── 2. Extract raw text ───────────────────────────────────────────────────
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
            raw_text, source_name = await route_youtube(youtube_url.strip())  # type: ignore[union-attr]

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"[Ingest] Parsing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to parse source: {e}")

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Extracted text is empty — check the file quality.")

    # ── 3. Run ingestion graph ────────────────────────────────────────────────
    try:
        result = await run_ingestion(
            raw_text=raw_text,
            subject=subject,
            topic=topic,
            source_name=source_name,
        )
    except Exception as e:
        logger.error(f"[Ingest] Pipeline failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ingestion pipeline failed: {e}")

    # ── 4. Build response ─────────────────────────────────────────────────────
    chapters_summary = [
        {"title": c["title"], "preview": c["content"][:250] + "..."}
        for c in result.get("chapters", [])
    ]

    return JSONResponse({
        "success": True,
        "source": source_name,
        "subject": subject,
        "topic": topic,
        "chunks_added": result["chunks_saved"],
        "completeness_score": result["completeness_score"],
        "chapters": chapters_summary,
        "mindmap": result.get("mindmap"),
        "warnings": result.get("errors", []),
    })
