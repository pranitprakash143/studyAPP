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
from core.config import get_settings
from api.jobs import create_job, update_job

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/ingest")
async def ingest(
    background_tasks: BackgroundTasks,
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
        f"[Ingest] Text size: {char_count:,} chars (limit: {settings.max_ingest_chars:,})"
    )

    # ── 3. Run ingestion graph (in background) ────────────────────────────────
    job_id = create_job()
    
    async def run_ingestion_background(
        job_id: str, raw_text: str, subject: str, topic: str, source_name: str
    ):
        try:
            result = await run_ingestion(
                raw_text=raw_text,
                subject=subject,
                topic=topic,
                source_name=source_name,
            )
            
            chapters_summary = [
                {"title": c["title"], "preview": c["content"][:250] + "..."}
                for c in result.get("chapters", [])
            ]
            wiki_result = result.get("wiki_result") or {}
            
            final_result = {
                "success": True,
                "source": source_name,
                "subject": subject,
                "topic": topic,
                "chunks_added": result.get("chunks_saved", 0),
                "completeness_score": result.get("completeness_score", 0),
                "chapters": chapters_summary,
                "wiki_pages_created": wiki_result.get("pages_created", 0),
                "wiki_pages_updated": wiki_result.get("pages_updated", 0),
                "warnings": result.get("errors", []),
            }
            update_job(job_id, "completed", result=final_result)
        except Exception as e:
            logger.error(f"[Ingest] Background Pipeline failed: {e}", exc_info=True)
            update_job(job_id, "failed", error=str(e))

    background_tasks.add_task(
        run_ingestion_background, job_id, raw_text, subject, topic, source_name
    )

    # ── 4. Build response ─────────────────────────────────────────────────────
    return JSONResponse(
        {
            "success": True,
            "status": "processing",
            "job_id": job_id,
            "message": "Ingestion started in the background.",
            "source": source_name,
            "subject": subject,
            "topic": topic,
        },
        status_code=202
    )
