import contextvars
from typing import Optional

# Async-safe request-scoped context variables to propagate client headers
ai_provider_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("ai_provider", default=None)
openai_api_key_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("openai_api_key", default=None)
openai_model_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("openai_model", default=None)
gemini_api_key_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("gemini_api_key", default=None)
gemini_model_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("gemini_model", default=None)

# Generic AI context variables for provider-independence
ai_api_key_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("ai_api_key", default=None)
ai_model_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("ai_model", default=None)

# Provider-specific context variables
groq_api_key_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("groq_api_key", default=None)
groq_model_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("groq_model", default=None)
openrouter_api_key_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("openrouter_api_key", default=None)
openrouter_model_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("openrouter_model", default=None)
mistral_api_key_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("mistral_api_key", default=None)
mistral_model_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("mistral_model", default=None)
deepseek_api_key_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("deepseek_api_key", default=None)
deepseek_model_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("deepseek_model", default=None)
