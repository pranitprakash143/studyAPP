# ─────────────────────────────────────────────────────────────────────────────
# backend/vectorstore/chroma_store.py
#
# ChromaDB client wrapper — raw chromadb-py + direct Gemini v1 REST API.
#
# Why not LangChain Chroma / google-generativeai SDK?
#   Both use the v1beta Gemini API endpoint, but text-embedding-004 is only
#   available on v1. We call the v1 embedContent endpoint directly via httpx.
# ─────────────────────────────────────────────────────────────────────────────
import logging
import hashlib
from functools import lru_cache

import chromadb

from core.config import get_settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Embedding function — uses google-generativeai SDK (v1 endpoint, not v1beta)
# ─────────────────────────────────────────────────────────────────────────────


class _GeminiEmbedder:
    """
    Calls the Gemini REST API for embeddings directly via httpx.
    Uses `gemini-embedding-001` (3072-dim) on the v1beta endpoint.

    Why gemini-embedding-001?
      The old model names (text-embedding-004, embedding-001) are NOT available
      on this API key. `gemini-embedding-001` IS available and confirmed working.
    """

    MODEL = "models/gemini-embedding-001"
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"

    def __init__(self, api_key: str):
        self._api_key = api_key
        logger.info(f"[Embedder] Using {self.MODEL} via v1beta REST API (3072-dim)")

    def _embed_one(
        self, text: str, task_type: str = "RETRIEVAL_DOCUMENT"
    ) -> list[float]:
        import httpx

        payload = {
            "model": self.MODEL,
            "content": {"parts": [{"text": text}]},
            "taskType": task_type,
        }
        resp = httpx.post(
            f"{self.BASE_URL}?key={self._api_key}",
            json=payload,
            timeout=30,
        )
        if not resp.is_success:
            raise RuntimeError(
                f"Gemini embedContent API error {resp.status_code}: {resp.text[:300]}"
            )
        return resp.json()["embedding"]["values"]

    def __call__(
        self, input: list[str], task_type: str = "RETRIEVAL_DOCUMENT"
    ) -> list[list[float]]:  # noqa: A002
        return [self._embed_one(text, task_type) for text in input]


class _OllamaEmbedder:
    """Fallback embedder for local Ollama (nomic-embed-text, 768-dim)."""

    def __init__(self, base_url: str, model: str = "nomic-embed-text"):
        self._base_url = base_url
        self._model = model

    def __call__(self, input: list[str]) -> list[list[float]]:  # noqa: A002
        import httpx

        embeddings: list[list[float]] = []
        for text in input:
            resp = httpx.post(
                f"{self._base_url}/api/embeddings",
                json={"model": self._model, "prompt": text},
                timeout=30,
            )
            resp.raise_for_status()
            embeddings.append(resp.json()["embedding"])
        return embeddings


@lru_cache(maxsize=1)
def _get_embedder():
    settings = get_settings()
    if settings.ai_provider == "cloud":
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is not set.")
        return _GeminiEmbedder(api_key=settings.gemini_api_key)
    else:
        return _OllamaEmbedder(
            base_url=settings.ollama_base_url,
            model="nomic-embed-text",
        )


# ─────────────────────────────────────────────────────────────────────────────
# ChromaDB client + collection singletons
# ─────────────────────────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def get_chroma_client() -> chromadb.HttpClient:
    """Return a cached HTTP ChromaDB client pointed at the Docker service."""
    settings = get_settings()
    client = chromadb.HttpClient(
        host=settings.chroma_host,
        port=settings.chroma_port,
    )
    logger.info(
        f"[ChromaDB] Connected to {settings.chroma_host}:{settings.chroma_port}"
    )
    return client


@lru_cache(maxsize=1)
def _get_collection():
    """Return the ChromaDB collection (create if not exists)."""
    settings = get_settings()
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=settings.chroma_collection,
        metadata={"hnsw:space": "cosine"},
    )
    logger.info(
        f"[ChromaDB] Collection ready: '{settings.chroma_collection}' ({collection.count()} docs)"
    )
    return collection


# Keep this for backward compatibility (health check in main.py)
def get_vector_store():
    return _get_collection()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _chunk_id(subject: str, topic: str, source: str, content: str) -> str:
    """Deterministic chunk ID — prevents duplicates on re-upload."""
    digest = hashlib.sha256(content.encode()).hexdigest()[:16]
    return f"{subject}__{topic}__{source}__{digest}".replace(" ", "_")


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────


async def upsert_chunks(
    chunks: list[dict],
    subject: str,
    topic: str,
    source: str,
) -> int:
    """
    Upsert document chunks into ChromaDB.
    Generates embeddings via google-generativeai (v1 endpoint).
    Uses deterministic content-hash IDs for idempotent upserts.
    Returns number of chunks upserted.
    """
    collection = _get_collection()
    embedder = _get_embedder()

    documents: list[str] = []
    metadatas: list[dict] = []
    ids: list[str] = []

    for chunk in chunks:
        content = chunk.get("content", "").strip()
        if not content:
            continue
        chapter_title = chunk.get("title", topic)
        subtopic = chunk.get("subtopic", "")
        doc_id = _chunk_id(subject, chapter_title, source, content)

        documents.append(content)
        metadatas.append(
            {
                "subject": subject,
                "topic": topic,
                "chapter": chapter_title,
                "subtopic": subtopic,
                "source": source,
                "chunk_id": doc_id,
            }
        )
        ids.append(doc_id)

    if not documents:
        logger.warning("[ChromaDB] No documents to upsert (all empty?)")
        return 0

    # Generate embeddings
    try:
        embeddings = embedder(documents)
    except Exception as e:
        logger.error(f"[ChromaDB] Embedding failed: {e}")
        raise RuntimeError(f"Error embedding content: {e}") from e

    # Upsert into ChromaDB (insert new, update existing by ID)
    collection.upsert(
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )
    logger.info(f"[ChromaDB] Upserted {len(documents)} chunks for {subject}/{topic}")
    return len(documents)


async def query_chunks(
    query: str,
    subject: str | None = None,
    top_k: int = 5,
) -> list[dict]:
    """Semantic search over ChromaDB, optionally filtered by subject."""
    collection = _get_collection()
    embedder = _get_embedder()

    # Embed the query using RETRIEVAL_QUERY task type for best semantic match
    try:
        if isinstance(embedder, _GeminiEmbedder):
            # Use RETRIEVAL_QUERY task type via our direct v1 REST API embedder
            query_embedding = embedder._embed_one(query, task_type="RETRIEVAL_QUERY")
        else:
            query_embedding = embedder([query])[0]
    except Exception as e:
        logger.error(f"[ChromaDB] Query embedding failed: {e}")
        raise RuntimeError(f"Error embedding query: {e}") from e

    where: dict | None = {"subject": {"$eq": subject}} if subject else None

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, max(collection.count(), 1)),
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    output: list[dict] = []
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for content, meta, distance in zip(docs, metas, distances):
        # Convert cosine distance to similarity score (0–1, higher = more similar)
        score = round(1 - distance, 4)
        output.append(
            {
                "content": content,
                "subject": meta.get("subject", ""),
                "topic": meta.get("topic", ""),
                "chapter": meta.get("chapter", ""),
                "subtopic": meta.get("subtopic", ""),
                "source": meta.get("source", ""),
                "chunk_id": meta.get("chunk_id", ""),
                "score": score,
            }
        )

    return output


async def query_chunks_with_hyde(
    query: str,
    subject: str | None = None,
    top_k: int = 5,
) -> list[dict]:
    """
    HyDE (Hypothetical Document Embeddings) retrieval.

    Instead of embedding the raw query, we first ask the LLM to generate a
    hypothetical ideal answer (~150 tokens). We then embed THAT answer and use
    it for ChromaDB search. This bridges the query-document linguistic gap:
    queries sound like questions; documents sound like answers.

    Research: Zhang et al. 2022 "Precise Zero-Shot Dense Retrieval without
    Relevance Labels". Expected improvement: 15-30% better recall@k.

    Falls back to standard query_chunks() on any failure.
    """
    from core.llm import generate_text as _gen

    # Step 1: Generate hypothetical ideal answer
    hyde_system = (
        "You are an expert exam tutor. Write a concise, factual answer to the "
        "following question, exactly as it would appear in a high-quality study guide. "
        "Be specific, use proper terminology, and keep it under 150 words. "
        "Focus on the most important facts."
    )
    try:
        hypothetical_answer = await _gen(
            prompt=f"Question: {query}\n\nWrite an ideal factual answer:",
            system_prompt=hyde_system,
            temperature=0.1,
            timeout=20,
        )
        logger.info(
            f"[HyDE] Generated hypothesis ({len(hypothetical_answer)} chars) for query: '{query[:60]}'"
        )
    except Exception as e:
        logger.warning(f"[HyDE] Hypothesis generation failed, falling back to standard retrieval: {e}")
        return await query_chunks(query=query, subject=subject, top_k=top_k)

    # Step 2: Embed the HYPOTHETICAL ANSWER (not the query)
    # Using RETRIEVAL_DOCUMENT task type because the hypothesis looks like a document
    collection = _get_collection()
    embedder = _get_embedder()

    try:
        if isinstance(embedder, _GeminiEmbedder):
            # Embed as RETRIEVAL_DOCUMENT since hypothesis looks like a document
            hyde_embedding = embedder._embed_one(hypothetical_answer, task_type="RETRIEVAL_DOCUMENT")
        else:
            hyde_embedding = embedder([hypothetical_answer])[0]
    except Exception as e:
        logger.warning(f"[HyDE] Embedding hypothesis failed, falling back to standard retrieval: {e}")
        return await query_chunks(query=query, subject=subject, top_k=top_k)

    # Step 3: Search ChromaDB with the hypothesis embedding
    where: dict | None = {"subject": {"$eq": subject}} if subject else None

    try:
        results = collection.query(
            query_embeddings=[hyde_embedding],
            n_results=min(top_k, max(collection.count(), 1)),
            where=where,
            include=["documents", "metadatas", "distances"],
        )
    except Exception as e:
        logger.warning(f"[HyDE] ChromaDB query failed, falling back to standard retrieval: {e}")
        return await query_chunks(query=query, subject=subject, top_k=top_k)

    output: list[dict] = []
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for content, meta, distance in zip(docs, metas, distances):
        score = round(1 - distance, 4)
        output.append(
            {
                "content": content,
                "subject": meta.get("subject", ""),
                "topic": meta.get("topic", ""),
                "chapter": meta.get("chapter", ""),
                "subtopic": meta.get("subtopic", ""),
                "source": meta.get("source", ""),
                "chunk_id": meta.get("chunk_id", ""),
                "score": score,
                "retrieval_method": "hyde",
            }
        )

    logger.info(f"[HyDE] Retrieved {len(output)} chunks using hypothesis embedding")
    return output


async def delete_subject(subject: str) -> int:
    """Delete all chunks for a subject. Returns count deleted."""
    collection = _get_collection()
    results = collection.get(where={"subject": {"$eq": subject}})
    ids = results.get("ids", [])
    if ids:
        collection.delete(ids=ids)
        logger.info(f"[ChromaDB] Deleted {len(ids)} chunks for subject '{subject}'")
    return len(ids)


async def delete_topic(subject: str, topic: str) -> int:
    """Delete all chunks for a specific subject+topic. Returns count deleted."""
    collection = _get_collection()
    results = collection.get(
        where={"$and": [{"subject": {"$eq": subject}}, {"topic": {"$eq": topic}}]}
    )
    ids = results.get("ids", [])
    if ids:
        collection.delete(ids=ids)
        logger.info(f"[ChromaDB] Deleted {len(ids)} chunks for {subject}/{topic}")
    return len(ids)


async def list_subjects() -> list[dict]:
    """Return all unique subjects with their topic lists."""
    collection = _get_collection()
    try:
        all_meta = collection.get(include=["metadatas"])["metadatas"] or []
    except Exception:
        return []

    subjects: dict[str, set[str]] = {}
    for meta in all_meta:
        subj = meta.get("subject", "Unknown")
        topic = meta.get("topic", "")
        subjects.setdefault(subj, set())
        if topic:
            subjects[subj].add(topic)

    return [
        {"subject": s, "topic_count": len(topics), "topics": sorted(topics)}
        for s, topics in sorted(subjects.items())
    ]


async def get_subject_chunks(subject: str) -> list[dict]:
    """Return all chunks for a subject."""
    collection = _get_collection()
    try:
        results = collection.get(
            where={"subject": {"$eq": subject}},
            include=["documents", "metadatas"],
        )
    except Exception:
        return []

    chunks = []
    for content, meta in zip(
        results.get("documents") or [],
        results.get("metadatas") or [],
    ):
        chunks.append(
            {
                "content": content,
                "topic": meta.get("topic", ""),
                "chapter": meta.get("chapter", ""),
                "subtopic": meta.get("subtopic", ""),
                "source": meta.get("source", ""),
            }
        )
    return chunks
