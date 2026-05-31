# backend/api/health.py
from fastapi import APIRouter
from vectorstore.chroma_store import get_chroma_client
from core.config import get_settings

router = APIRouter()


@router.get("/health")
async def health():
    """Health check — verifies FastAPI is running and ChromaDB is reachable."""
    settings = get_settings()
    chroma_ok = False
    chroma_info = {}

    try:
        client = get_chroma_client()
        # Heartbeat returns {"nanosecond heartbeat": int}
        heartbeat = client.heartbeat()
        chroma_ok = True
        chroma_info = {"status": "connected", "heartbeat": heartbeat}
    except Exception as e:
        chroma_info = {"status": "error", "message": str(e)}

    return {
        "status": "ok" if chroma_ok else "degraded",
        "service": settings.app_name,
        "version": settings.app_version,
        "ai_provider": settings.ai_provider,
        "chromadb": chroma_info,
    }
