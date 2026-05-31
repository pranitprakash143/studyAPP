import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

PENDING_FILE = Path("/app/knowledge_base/metadata/pending_processing.json")


def _load() -> dict:
    """Load pending processing queue."""
    try:
        if PENDING_FILE.exists():
            return json.loads(PENDING_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"[Pending] Failed to load pending file: {e}")
    return {}


def _save(data: dict) -> None:
    PENDING_FILE.parent.mkdir(parents=True, exist_ok=True)
    PENDING_FILE.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def mark_pending(subject: str, topic: str, source_name: str, raw_text: str) -> str:
    """Add a pending ingestion entry for a subject. Returns entry ID."""
    data = _load()
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
    _save(data)
    logger.info(
        f"[Pending] Marked '{subject}/{topic}' as pending (id={entry_id[:24]}...)"
    )
    return entry_id


def get_pending(subject: str) -> list[dict]:
    """Get all pending entries for a subject."""
    data = _load()
    return data.get(subject, [])


def has_pending(subject: str) -> bool:
    """Check if a subject has pending processing."""
    return bool(get_pending(subject))


def all_pending_subjects() -> list[str]:
    """Return list of subjects that have pending items."""
    data = _load()
    return [s for s, items in data.items() if items]


def clear_pending(subject: str) -> None:
    """Remove all pending entries for a subject after processing."""
    data = _load()
    if subject in data:
        del data[subject]
    _save(data)
    logger.info(f"[Pending] Cleared pending queue for '{subject}'")


def count_pending() -> int:
    """Return total number of pending entries across all subjects."""
    data = _load()
    return sum(len(items) for items in data.values())
