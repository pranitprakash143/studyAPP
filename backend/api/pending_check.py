import logging

from fastapi import APIRouter

from api.pending import has_pending, count_pending, all_pending_subjects

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/pending/{subject}")
async def check_pending(subject: str):
    """Check if a subject has pending items waiting to be processed."""
    return {
        "subject": subject,
        "has_pending": await has_pending(subject),
    }


@router.get("/api/pending")
async def list_pending():
    """List all subjects with pending items and total count."""
    subjects = await all_pending_subjects()
    return {
        "subjects": subjects,
        "total": await count_pending(),
    }
