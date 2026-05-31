# ─────────────────────────────────────────────────────────────────────────────
# backend/core/llm.py
# LLM + Embedding factory — returns the correct LangChain chat model
# and embedding model based on the configured AI provider.
# ─────────────────────────────────────────────────────────────────────────────
from functools import lru_cache
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.embeddings import Embeddings

from core.config import get_settings


# ─────────────────────────────────────────────────────────────────────────────
# Chat LLM
# ─────────────────────────────────────────────────────────────────────────────

def get_llm(temperature: float = 0.2) -> BaseChatModel:
    """
    Return the appropriate LangChain chat model based on settings.

    Cloud  → Google Gemini (ChatGoogleGenerativeAI)
    Local  → Ollama running on host machine
    """
    settings = get_settings()

    if settings.ai_provider == "cloud":
        if not settings.gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY is not set. "
                "Add it to your .env file or set AI_PROVIDER=local to use Ollama."
            )
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
            temperature=temperature,
            convert_system_message_to_human=False,
        )
    else:
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            temperature=temperature,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Embeddings
# ─────────────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_embeddings() -> Embeddings:
    """
    Return the appropriate embedding model.

    Cloud  → Google text-embedding-004 (768 dims)
    Local  → Ollama nomic-embed-text (768 dims, must be pulled first)
    """
    settings = get_settings()

    if settings.ai_provider == "cloud":
        from langchain_google_genai import GoogleGenerativeAIEmbeddings

        # LangChain GoogleGenerativeAIEmbeddings expects the model name WITHOUT
        # the 'models/' prefix — the library prepends it internally.
        # e.g. 'text-embedding-004' not 'models/text-embedding-004'
        embedding_model = settings.gemini_embedding_model
        if embedding_model.startswith("models/"):
            embedding_model = embedding_model[len("models/"):]

        return GoogleGenerativeAIEmbeddings(
            model=embedding_model,
            google_api_key=settings.gemini_api_key,
            task_type="retrieval_document",
        )
    else:
        from langchain_ollama import OllamaEmbeddings

        return OllamaEmbeddings(
            model="nomic-embed-text",
            base_url=settings.ollama_base_url,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: raw text generation (non-LangChain format)
# Used internally by graph nodes that need a plain string response.
# ─────────────────────────────────────────────────────────────────────────────

async def generate_text(
    prompt: str,
    system_prompt: str | None = None,
    temperature: float = 0.2,
    json_mode: bool = False,
) -> str:
    """Generate a plain-string response from the configured LLM."""
    from langchain_core.messages import HumanMessage, SystemMessage

    messages: list[Any] = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(HumanMessage(content=prompt))

    llm = get_llm(temperature=temperature)

    # Bind JSON mode if requested and provider supports it
    if json_mode:
        settings = get_settings()
        if settings.ai_provider == "cloud":
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.output_parsers import StrOutputParser
            # Gemini JSON mode via mime type
            llm = llm.bind(
                generation_config={"response_mime_type": "application/json"}
            )

    response = await llm.ainvoke(messages)
    return str(response.content).strip()
