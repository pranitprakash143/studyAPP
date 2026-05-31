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
from api.wiki import router as wiki_router
from api.jobs import router as jobs_router
from api.reset import router as reset_router
from api.process import router as process_router
from api.pending_check import router as pending_check_router
from api.tasks_router import router as tasks_router

import os
from logging.handlers import RotatingFileHandler

# ── Logging ──────────────────────────────────────────────────────────────────
# Setup persistent log folder inside shared knowledge_base volume
LOG_DIR = "/app/knowledge_base/logs"
try:
    os.makedirs(LOG_DIR, exist_ok=True)
except Exception:
    pass

BACKEND_LOG_FILE = os.path.join(LOG_DIR, "backend.log")

formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s — %(message)s")

console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)

try:
    file_handler = RotatingFileHandler(
        BACKEND_LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=2, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    handlers = [console_handler, file_handler]
except Exception:
    handlers = [console_handler]

logging.basicConfig(level=logging.INFO, handlers=handlers)
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
                logger.error(
                    f"❌ ChromaDB unavailable after {max_retries} attempts: {e}"
                )
                logger.warning(
                    "   Backend will start but ChromaDB calls will fail until it recovers."
                )
            else:
                logger.warning(
                    f"⏳ ChromaDB not ready ({attempt}/{max_retries}): {e} — retrying in 2s…"
                )
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

# ── Request ContextVars Middleware ───────────────────────────────────────────
from fastapi import Request

@app.middleware("http")
async def add_context_vars(request: Request, call_next):
    from core.context import (
        ai_provider_var,
        openai_api_key_var,
        openai_model_var,
        gemini_api_key_var,
        gemini_model_var,
        ai_api_key_var,
        ai_model_var,
        groq_api_key_var,
        groq_model_var,
        openrouter_api_key_var,
        openrouter_model_var,
        mistral_api_key_var,
        mistral_model_var,
        deepseek_api_key_var,
        deepseek_model_var,
    )
    
    provider = request.headers.get("x-ai-provider")
    openai_key = request.headers.get("x-openai-api-key")
    openai_model = request.headers.get("x-openai-model")
    gemini_key = request.headers.get("x-gemini-api-key")
    gemini_model = request.headers.get("x-gemini-model")
    
    ai_key = request.headers.get("x-ai-api-key")
    ai_model = request.headers.get("x-ai-model")
    
    groq_key = request.headers.get("x-groq-api-key")
    groq_model = request.headers.get("x-groq-model")
    
    openrouter_key = request.headers.get("x-openrouter-api-key")
    openrouter_model = request.headers.get("x-openrouter-model")
    
    mistral_key = request.headers.get("x-mistral-api-key")
    mistral_model = request.headers.get("x-mistral-model")
    
    deepseek_key = request.headers.get("x-deepseek-api-key")
    deepseek_model = request.headers.get("x-deepseek-model")
    
    tokens = []
    
    def safe_set(var, val):
        if val:
            tokens.append((var, var.set(val)))
            
    safe_set(ai_provider_var, provider)
    safe_set(openai_api_key_var, openai_key)
    safe_set(openai_model_var, openai_model)
    safe_set(gemini_api_key_var, gemini_key)
    safe_set(gemini_model_var, gemini_model)
    
    safe_set(ai_api_key_var, ai_key)
    safe_set(ai_model_var, ai_model)
    
    safe_set(groq_api_key_var, groq_key)
    safe_set(groq_model_var, groq_model)
    safe_set(openrouter_api_key_var, openrouter_key)
    safe_set(openrouter_model_var, openrouter_model)
    safe_set(mistral_api_key_var, mistral_key)
    safe_set(mistral_model_var, mistral_model)
    safe_set(deepseek_api_key_var, deepseek_key)
    safe_set(deepseek_model_var, deepseek_model)
    
    try:
        response = await call_next(request)
        return response
    finally:
        for var, token in reversed(tokens):
            var.reset(token)

# ── Routers ─────────────────────────────────────────────────────────────────────────────
app.include_router(health_router, tags=["health"])
app.include_router(ingest_router, tags=["ingestion"])
app.include_router(query_router, tags=["search"])
app.include_router(subjects_router, tags=["subjects"])
app.include_router(wiki_router, tags=["wiki"])
app.include_router(jobs_router, tags=["jobs"])
app.include_router(reset_router, tags=["reset"])
app.include_router(process_router, tags=["process"])
app.include_router(pending_check_router, tags=["pending"])
app.include_router(tasks_router, tags=["tasks"])
