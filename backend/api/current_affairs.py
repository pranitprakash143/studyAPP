import asyncio
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from vectorstore.chroma_store import delete_topic, upsert_chunks

logger = logging.getLogger(__name__)
router = APIRouter()

SUBJECT_NAME = "Current Affairs"
_file_lock = asyncio.Lock()


class NewsItem(BaseModel):
    headline: str
    summary: str
    examRelevance: str
    source: str
    category: str
    imageUrl: Optional[str] = None


class CurrentAffairsSaveInput(BaseModel):
    items: list[NewsItem]
    topic: Optional[str] = None


def _format_item_as_markdown(item: NewsItem) -> str:
    lines = [
        f"### {item.category}",
        f"**Headline**: {item.headline}",
        f"Summary: {item.summary}",
        f"Source: {item.source} | Exam: {item.examRelevance}",
    ]
    if item.imageUrl:
        lines.append(f"![Illustration]({item.imageUrl})")
    lines.append("")
    return "\n".join(lines)


@router.post("/api/current-affairs/save")
async def save_current_affairs(payload: CurrentAffairsSaveInput):
    """Save current affairs news items to the knowledge base under 'Current Affairs' subject.

    Each item is stored as a separate chunk in ChromaDB.
    Items are also appended to a markdown file for human reading.
    """
    try:
        topic = payload.topic or datetime.now().strftime("%B %d, %Y")

        chunks = []
        markdown_entries = []

        for item in payload.items:
            content = (
                f"**Headline**: {item.headline}\n"
                f"Summary: {item.summary}\n"
                f"Source: {item.source} | Exam: {item.examRelevance}"
            )
            if item.imageUrl:
                content += f"\nImage: {item.imageUrl}"
            chunks.append(
                {
                    "content": content,
                    "title": f"{topic} - {item.category}",
                    "subtopic": item.headline,
                }
            )
            markdown_entries.append(_format_item_as_markdown(item))

        async with _file_lock:
            # Replace ChromaDB chunks for this topic (delete then upsert)
            await delete_topic(SUBJECT_NAME, topic)
            chroma_count = await upsert_chunks(
                chunks=chunks,
                subject=SUBJECT_NAME,
                topic=topic,
                source=f"{SUBJECT_NAME}/{topic}",
            )

            here = Path(__file__).resolve().parent.parent
            binders_dir = here / "knowledge_base" / "binders"
            binders_dir.mkdir(parents=True, exist_ok=True)
            filepath = binders_dir / f"{SUBJECT_NAME}.md"

            date_header = f"## {topic}\n"
            section_content = "\n".join(markdown_entries)
            new_section = f"{date_header}\n{section_content}\n"

            if filepath.exists():
                existing = filepath.read_text(encoding="utf-8")
                section_re = re.compile(
                    rf"^## {re.escape(topic)}\n.*?(?=^## |\Z)",
                    re.MULTILINE | re.DOTALL,
                )
                if section_re.search(existing):
                    updated = section_re.sub(new_section, existing)
                else:
                    updated = existing.rstrip() + "\n\n" + new_section
                filepath.write_text(updated, encoding="utf-8")
            else:
                filepath.write_text(
                    f"# Subject: {SUBJECT_NAME}\n\n"
                    f"_{datetime.now().strftime('%B %d, %Y')}_ — AI-curated current affairs digest.\n\n"
                    f"{new_section}\n",
                    encoding="utf-8",
                )

        logger.info(
            f"[CurrentAffairs] Saved {len(payload.items)} items to '{SUBJECT_NAME}/{topic}'"
        )

        return {
            "success": True,
            "subject": SUBJECT_NAME,
            "topic": topic,
            "items_saved": len(payload.items),
            "chunks_added": chroma_count,
        }

    except Exception as e:
        logger.error(f"[CurrentAffairs] Save failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
