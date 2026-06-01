import logging
import json
import os
from pathlib import Path

from fastapi import APIRouter

import vectorstore.chroma_store as chroma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reset", tags=["reset"])

KNOWLEDGE_BASE = Path("/app/knowledge_base")

# ── Helpers ────────────────────────────────────────────────────────────────────


def _reset_chromadb() -> dict:
    """Delete all documents from the ChromaDB collection."""
    try:
        collection = chroma._get_collection()
        all_ids = collection.get()["ids"]
        if all_ids:
            collection.delete(ids=all_ids)
        count = len(all_ids)
        logger.info(f"[Reset] ChromaDB cleared: {count} documents removed")
        return {"deleted": count, "status": "cleared"}
    except Exception as e:
        logger.error(f"[Reset] Failed to clear ChromaDB: {e}")
        return {"deleted": 0, "status": f"error: {e}"}


def _reset_wiki() -> dict:
    """Delete all wiki directory contents."""
    wiki_dir = KNOWLEDGE_BASE / "wiki"
    deleted_files = 0
    try:
        if wiki_dir.exists():
            for child in wiki_dir.rglob("*"):
                if child.is_file():
                    child.unlink()
                    deleted_files += 1
            # Clean up empty subdirectories
            for child in sorted(wiki_dir.rglob("*"), reverse=True):
                if child.is_dir():
                    try:
                        child.rmdir()
                    except OSError:
                        pass
        logger.info(f"[Reset] Wiki cleared: {deleted_files} files removed")
        return {"deleted": deleted_files, "status": "cleared"}
    except Exception as e:
        logger.error(f"[Reset] Failed to clear wiki: {e}")
        return {"deleted": deleted_files, "status": f"error: {e}"}


def _reset_master_kb() -> dict:
    """Truncate master_kb.md."""
    path = KNOWLEDGE_BASE / "master_kb.md"
    try:
        path.write_text("") if path.exists() else path.write_text("")
        logger.info("[Reset] master_kb.md cleared")
        return {"status": "cleared"}
    except Exception as e:
        logger.error(f"[Reset] Failed to clear master_kb.md: {e}")
        return {"status": f"error: {e}"}


def _reset_metadata() -> dict:
    """Reset all JSON metadata files to empty arrays or objects."""
    meta_dir = KNOWLEDGE_BASE / "metadata"
    results: dict[str, str] = {}
    try:
        meta_dir.mkdir(parents=True, exist_ok=True)
        for filename, default in [
            ("vector_db.json", "{}"),
            ("highlights.json", "[]"),
            ("mindmaps.json", "[]"),
        ]:
            filepath = meta_dir / filename
            filepath.write_text(default + "\n")
            results[filename] = "reset"
        logger.info(f"[Reset] Metadata files reset: {list(results.keys())}")
        return results
    except Exception as e:
        logger.error(f"[Reset] Failed to reset metadata: {e}")
        return {"error": str(e)}


# ── Route ──────────────────────────────────────────────────────────────────────


@router.post("")
async def reset_all():
    """Completely reset all application data.

    Clears:
    - ChromaDB vector store
    - Wiki pages
    - master_kb.md
    - Metadata files (vector_db.json, highlights.json, mindmaps.json)
    """
    results = {
        "chromadb": _reset_chromadb(),
        "wiki": _reset_wiki(),
        "master_kb": _reset_master_kb(),
        "metadata": _reset_metadata(),
    }

    ok = all(r.get("status") == "cleared" or "error" not in r for r in results.values())

    return {
        "success": ok,
        "message": "All databases cleared successfully."
        if ok
        else "Some resets failed. Check logs for details.",
        "results": results,
    }
