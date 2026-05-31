# ─────────────────────────────────────────────────────────────────────────────
# backend/core/config.py
# Centralised settings loaded from environment variables / .env file.
# All config values are typed and validated via Pydantic BaseSettings.
# ─────────────────────────────────────────────────────────────────────────────
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration — read from env vars or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    app_name: str = "PrepAgent Backend"
    app_version: str = "0.1.0"
    debug: bool = False

    # ── Central AI Providers ──────────────────────────────────────────────────
    # "cloud" uses Google Gemini; "local" uses Ollama; "openai" uses OpenAI
    ai_provider: str = "cloud"  # "cloud" | "local" | "openai"

    # Google Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    gemini_embedding_model: str = "models/text-embedding-001"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"

    # Groq
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # OpenRouter
    openrouter_api_key: str = ""
    openrouter_model: str = "openrouter/free"

    # Mistral
    mistral_api_key: str = ""
    mistral_model: str = "mistral-small-latest"

    # DeepSeek
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-v4-flash"

    # Ollama (local)
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3"

    # ── ChromaDB ─────────────────────────────────────────────────────────────
    chroma_host: str = "chromadb"  # Docker service name
    chroma_port: int = 8001
    chroma_collection: str = "prepagent_kb"

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins for CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    # ── File Uploads ─────────────────────────────────────────────────────────
    max_upload_size_mb: int = 15
    upload_dir: str = "/app/uploads"

    # ── Ingestion Limits ─────────────────────────────────────────────────────
    # Maximum characters of extracted text the pipeline will process.
    # Documents exceeding this will be rejected with a clear error.
    # 80,000 chars ≈ 40 pages of dense text — optimal for LLM context quality.
    max_ingest_chars: int = 80_000


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
