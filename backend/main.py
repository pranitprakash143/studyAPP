# ─────────────────────────────────────────────────────────────────────────────
# backend/main.py
# FastAPI application entrypoint.
# ─────────────────────────────────────────────────────────────────────────────
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from api.health import router as health_router
from api.ingest import router as ingest_router
from api.query import router as query_router
from api.subjects import router as subjects_router

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up ChromaDB connection on startup with retry logic."""
    import asyncio
    settings = get_settings()
    logger.info(f"🚀 Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"   AI Provider : {settings.ai_provider}")
    logger.info(f"   ChromaDB    : {settings.chroma_host}:{settings.chroma_port}")

    # Retry ChromaDB connection — it may not be ready immediately after container start
    from vectorstore.chroma_store import get_chroma_client, get_vector_store
    max_retries = 15
    for attempt in range(1, max_retries + 1):
        try:
            get_chroma_client()
            get_vector_store()
            logger.info(f"✅ ChromaDB connected (attempt {attempt}/{max_retries})")
            break
        except Exception as e:
            if attempt == max_retries:
                logger.error(f"❌ ChromaDB unavailable after {max_retries} attempts: {e}")
                logger.warning("   Backend will start but ChromaDB calls will fail until it recovers.")
            else:
                logger.warning(f"⏳ ChromaDB not ready ({attempt}/{max_retries}): {e} — retrying in 2s…")
                await asyncio.sleep(2)

    yield  # App is running

    logger.info("Shutting down PrepAgent backend…")


# ── App ───────────────────────────────────────────────────────────────────────
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "PrepAgent Backend — AI-powered study assistant. "
        "Provides PDF/DOCX/YouTube ingestion, vector search, and LangGraph workflows."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health_router, tags=["health"])
app.include_router(ingest_router, tags=["ingestion"])
app.include_router(query_router, tags=["retrieval"])
app.include_router(subjects_router, tags=["subjects"])
