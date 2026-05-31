# ─────────────────────────────────────────────────────────────────────────────
# backend/core/llm.py
# LLM + Embedding factory — returns the correct LangChain chat model
# and embedding model based on the resolved AI provider (request-scoped headers).
# ─────────────────────────────────────────────────────────────────────────────
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.embeddings import Embeddings

from core.config import get_settings
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


def get_resolved_ai_config() -> dict[str, Any]:
    """Resolve AI provider settings from contextvars with settings fallbacks."""
    settings = get_settings()
    
    # Resolve provider
    provider = ai_provider_var.get() or settings.ai_provider
    if provider == "google":
        provider = "cloud"
        
    # Generic request-scoped credentials
    generic_key = ai_api_key_var.get()
    generic_model = ai_model_var.get()
    
    # Resolve OpenAI config
    openai_key = (generic_key if provider == "openai" else None) or openai_api_key_var.get() or settings.openai_api_key
    openai_model = (generic_model if provider == "openai" else None) or openai_model_var.get() or settings.openai_model
    
    # Resolve Gemini config
    gemini_key = (generic_key if provider in ("cloud", "google") else None) or gemini_api_key_var.get() or settings.gemini_api_key
    gemini_model = (generic_model if provider in ("cloud", "google") else None) or gemini_model_var.get() or settings.gemini_model
    
    # Resolve Groq config
    groq_key = (generic_key if provider == "groq" else None) or groq_api_key_var.get() or settings.groq_api_key
    groq_model = (generic_model if provider == "groq" else None) or groq_model_var.get() or settings.groq_model
    
    # Resolve OpenRouter config
    openrouter_key = (generic_key if provider == "openrouter" else None) or openrouter_api_key_var.get() or settings.openrouter_api_key
    openrouter_model = (generic_model if provider == "openrouter" else None) or openrouter_model_var.get() or settings.openrouter_model
    
    # Resolve Mistral config
    mistral_key = (generic_key if provider == "mistral" else None) or mistral_api_key_var.get() or settings.mistral_api_key
    mistral_model = (generic_model if provider == "mistral" else None) or mistral_model_var.get() or settings.mistral_model
    
    # Resolve DeepSeek config
    deepseek_key = (generic_key if provider == "deepseek" else None) or deepseek_api_key_var.get() or settings.deepseek_api_key
    deepseek_model = (generic_model if provider == "deepseek" else None) or deepseek_model_var.get() or settings.deepseek_model
    
    return {
        "provider": provider,
        "openai_key": openai_key,
        "openai_model": openai_model,
        "openai_embedding_model": settings.openai_embedding_model,
        "gemini_key": gemini_key,
        "gemini_model": gemini_model,
        "gemini_embedding_model": settings.gemini_embedding_model,
        "groq_key": groq_key,
        "groq_model": groq_model,
        "openrouter_key": openrouter_key,
        "openrouter_model": openrouter_model,
        "mistral_key": mistral_key,
        "mistral_model": mistral_model,
        "deepseek_key": deepseek_key,
        "deepseek_model": deepseek_model,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Chat LLM
# ─────────────────────────────────────────────────────────────────────────────


def get_llm(temperature: float = 0.2) -> BaseChatModel:
    """
    Return the appropriate LangChain chat model based on resolved request settings.

    OpenAI, Groq, OpenRouter, Mistral, DeepSeek → ChatOpenAI with dynamic endpoints
    Cloud  → Google Gemini (ChatGoogleGenerativeAI)
    Local  → Ollama running on host machine
    """
    config = get_resolved_ai_config()
    provider = config["provider"]

    if provider == "openai":
        if not config["openai_key"]:
            raise ValueError(
                "OpenAI API Key is not set. Add it in Settings."
            )
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=config["openai_model"],
            api_key=config["openai_key"],
            temperature=temperature,
        )
    elif provider == "groq":
        if not config["groq_key"]:
            raise ValueError("Groq API Key is not set. Add it in Settings.")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config["groq_model"],
            api_key=config["groq_key"],
            base_url="https://api.groq.com/openai/v1",
            temperature=temperature,
        )
    elif provider == "openrouter":
        if not config["openrouter_key"]:
            raise ValueError("OpenRouter API Key is not set. Add it in Settings.")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config["openrouter_model"],
            api_key=config["openrouter_key"],
            base_url="https://openrouter.ai/api/v1",
            temperature=temperature,
        )
    elif provider == "mistral":
        if not config["mistral_key"]:
            raise ValueError("Mistral API Key is not set. Add it in Settings.")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config["mistral_model"],
            api_key=config["mistral_key"],
            base_url="https://api.mistral.ai/v1",
            temperature=temperature,
        )
    elif provider == "deepseek":
        if not config["deepseek_key"]:
            raise ValueError("DeepSeek API Key is not set. Add it in Settings.")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config["deepseek_model"],
            api_key=config["deepseek_key"],
            base_url="https://api.deepseek.com",
            temperature=temperature,
        )
    elif provider == "cloud" or provider == "google":
        if not config["gemini_key"]:
            raise ValueError(
                "GEMINI_API_KEY is not set. Add it in Settings."
            )
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=config["gemini_model"],
            google_api_key=config["gemini_key"],
            temperature=temperature,
            convert_system_message_to_human=False,
        )
    else:
        from langchain_ollama import ChatOllama
        settings = get_settings()

        return ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            temperature=temperature,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Embeddings
# ─────────────────────────────────────────────────────────────────────────────


def get_embeddings() -> Embeddings:
    """
    Return the appropriate embedding model based on resolved request settings.

    OpenAI → OpenAI Embeddings (text-embedding-3-small)
    Cloud  → Google text-embedding-001 or text-embedding-004 (768 dims)
    Local  → Ollama nomic-embed-text (768 dims, must be pulled first)
    """
    config = get_resolved_ai_config()
    provider = config["provider"]

    if provider == "openai":
        if not config["openai_key"]:
            raise ValueError("OpenAI API Key is not set. Add it in Settings.")
        from langchain_openai import OpenAIEmbeddings

        return OpenAIEmbeddings(
            model=config["openai_embedding_model"],
            api_key=config["openai_key"],
        )
    elif provider == "cloud" or provider == "google":
        from langchain_google_genai import GoogleGenerativeAIEmbeddings

        embedding_model = config["gemini_embedding_model"]
        if embedding_model.startswith("models/"):
            embedding_model = embedding_model[len("models/") :]

        return GoogleGenerativeAIEmbeddings(
            model=embedding_model,
            google_api_key=config["gemini_key"],
            task_type="retrieval_document",
        )
    else:
        from langchain_ollama import OllamaEmbeddings
        settings = get_settings()

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
    timeout: int | None = None,
) -> str:
    """Generate a plain-string response from the configured LLM."""
    from langchain_core.messages import HumanMessage, SystemMessage

    messages: list[Any] = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(HumanMessage(content=prompt))

    llm = get_llm(temperature=temperature)

    # Add timeout if provided
    if timeout is not None:
        llm = llm.with_config({"timeout": timeout, "max_retries": 1})

    # Bind JSON mode if requested and provider supports it
    if json_mode:
        config = get_resolved_ai_config()
        provider = config["provider"]
        if provider == "cloud" or provider == "google":
            llm = llm.bind(generation_config={"response_mime_type": "application/json"})
        elif provider in ("openai", "groq", "openrouter", "mistral", "deepseek"):
            llm = llm.bind(response_format={"type": "json_object"})

    response = await llm.ainvoke(messages)
    return str(response.content).strip()
