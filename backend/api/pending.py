import json
import logging
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Find KB dir relative to this file to work in local dev and Docker container
def _find_kb_dir() -> Path:
    here = Path(__file__).resolve().parent
    for candidate in [here.parent, here.parent.parent, here.parent.parent.parent]:
        kb = candidate / "knowledge_base"
        if kb.exists():
            return kb
    return here.parent / "knowledge_base"

KB_DIR = _find_kb_dir()
PENDING_FILE = KB_DIR / "metadata" / "pending_processing.json"


def _load_sync() -> dict:
    """Load pending processing queue synchronously."""
    try:
        if PENDING_FILE.exists():
            return json.loads(PENDING_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"[Pending] Failed to load pending file: {e}")
    return {}


def _save_sync(data: dict) -> None:
    """Save pending processing queue synchronously."""
    PENDING_FILE.parent.mkdir(parents=True, exist_ok=True)
    PENDING_FILE.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )


async def _load() -> dict:
    """Load pending processing queue asynchronously in a background thread."""
    return await asyncio.to_thread(_load_sync)


async def _save(data: dict) -> None:
    """Save pending processing queue asynchronously in a background thread."""
    await asyncio.to_thread(_save_sync, data)


async def mark_pending(subject: str, topic: str, source_name: str, raw_text: str) -> str:
    """Add a pending ingestion entry for a subject. Returns entry ID."""
    data = await _load()
    if subject not in data:
        data[subject] = []
    entry_id = (
        f"{subject}_{topic}_{source_name}_{datetime.now(timezone.utc).timestamp()}"
    )
    data[subject].append(
        {
            "id": entry_id,
            "topic": topic,
            "source_name": source_name,
            "raw_text": raw_text,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    await _save(data)
    logger.info(
        f"[Pending] Marked '{subject}/{topic}' as pending (id={entry_id[:24]}...)"
    )
    return entry_id


async def get_pending(subject: str) -> list[dict]:
    """Get all pending entries for a subject."""
    data = await _load()
    return data.get(subject, [])


async def has_pending(subject: str) -> bool:
    """Check if a subject has pending processing."""
    return bool(await get_pending(subject))


async def all_pending_subjects() -> list[str]:
    """Return list of subjects that have pending items."""
    data = await _load()
    return [s for s, items in data.items() if items]


async def clear_pending(subject: str) -> None:
    """Remove all pending entries for a subject after processing."""
    data = await _load()
    if subject in data:
        del data[subject]
    await _save(data)
    logger.info(f"[Pending] Cleared pending queue for '{subject}'")


async def count_pending() -> int:
    """Return total number of pending entries across all subjects."""
    data = await _load()
    return sum(len(items) for items in data.values())
