# ─────────────────────────────────────────────────────────────────────────────
# backend/wiki/wiki_compiler.py
#
# LLM Wiki Compiler — Karpathy pattern implementation.
#
# Concept: After each ingestion, compile newly ingested subtopic chunks into
# structured, interlinked Markdown "entity pages" stored in knowledge_base/wiki/.
# These pages are human-readable, agent-maintained, and compound with every
# new ingestion. They are searched FIRST before raw ChromaDB chunks.
#
# Architecture:
#   knowledge_base/wiki/
#   ├── index.json                    ← master index (all pages + graph edges)
#   ├── {subject}/
#   │   ├── {slug}.md                 ← compiled entity page
#   │   └── ...
#   └── ...
#
# Page format (frontmatter + sections):
#   ---
#   title: Maurya Empire
#   subject: History
#   tags: [ancient, administration, economy]
#   related: [Arthashastra, Chandragupta, Ashoka]
#   sources: [ncert_history_ch3.pdf]
#   last_compiled: 2026-05-31T06:00:00Z
#   ---
#   ## Summary
#   ## Key Facts
#   ## Connections
#   ## Memory Hooks
#   ## Quick Revision
# ─────────────────────────────────────────────────────────────────────────────
import json
import logging
import os
import re
import unicodedata
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from core.llm import generate_text

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Path resolution — find knowledge_base/ relative to this file
# Works in both Docker (/app/knowledge_base) and local dev
# ─────────────────────────────────────────────────────────────────────────────


def _find_kb_dir() -> Path:
    """Walk up from this file to find knowledge_base/ directory."""
    # backend/wiki/wiki_compiler.py → backend/wiki/
    here = Path(__file__).resolve().parent
    for candidate in [here.parent, here.parent.parent, here.parent.parent.parent]:
        kb = candidate / "knowledge_base"
        if kb.exists():
            return kb
    # Fallback: create alongside backend
    kb = here.parent / "knowledge_base"
    kb.mkdir(parents=True, exist_ok=True)
    return kb


KB_DIR = _find_kb_dir()
WIKI_DIR = KB_DIR / "wiki"
WIKI_INDEX_PATH = WIKI_DIR / "index.json"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _slugify(text: str, max_length: int = 80) -> str:
    """Convert text to a filesystem-safe slug, truncated to max_length."""
    text = unicodedata.normalize("NFKD", text)
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[\s_-]+", "-", text).strip("-")
    if len(text) > max_length:
        text = text[:max_length].rstrip("-")
    return text or "page"


def _wiki_page_path(subject: str, title: str) -> Path:
    subject_dir = WIKI_DIR / _slugify(subject)
    subject_dir.mkdir(parents=True, exist_ok=True)
    return subject_dir / f"{_slugify(title)}.md"


def _load_index() -> dict:
    """Load the wiki index JSON. Returns empty structure if not found."""
    if WIKI_INDEX_PATH.exists():
        try:
            return json.loads(WIKI_INDEX_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"pages": [], "edges": []}


def _save_index(index: dict) -> None:
    WIKI_DIR.mkdir(parents=True, exist_ok=True)
    WIKI_INDEX_PATH.write_text(
        json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def _parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML-style frontmatter from wiki page. Returns (meta, body)."""
    if not content.startswith("---"):
        return {}, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    meta: dict = {}
    for line in parts[1].strip().splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            raw_val = val.strip()
            # Parse simple lists: [a, b, c]
            if raw_val.startswith("[") and raw_val.endswith("]"):
                items = [
                    x.strip().strip("\"'")
                    for x in raw_val[1:-1].split(",")
                    if x.strip()
                ]
                meta[key.strip()] = items
            else:
                meta[key.strip()] = raw_val.strip("\"'")
    return meta, parts[2].strip()


def _build_frontmatter(meta: dict) -> str:
    lines = ["---"]
    for k, v in meta.items():
        if isinstance(v, list):
            lines.append(f"{k}: [{', '.join(v)}]")
        else:
            lines.append(f"{k}: {v}")
    lines.append("---")
    return "\n".join(lines)


def _merge_related(existing: list[str], new_related: list[str]) -> list[str]:
    """Merge related topic lists, deduplicate preserving order."""
    seen = set(existing)
    merged = list(existing)
    for item in new_related:
        if item not in seen:
            seen.add(item)
            merged.append(item)
    return merged[:20]  # cap at 20 cross-links


# ─────────────────────────────────────────────────────────────────────────────
# AI compilation
# ─────────────────────────────────────────────────────────────────────────────

WIKI_COMPILE_SYSTEM = """\
You are a Knowledge Synthesis Agent compiling a structured wiki page from study material.

TASK: Produce a structured wiki page for the given topic, drawing ONLY from the provided source chunks.

ABSOLUTE RULES:
1. SOURCE-ONLY: Every fact must come directly from the provided chunks. No additions.
2. ZERO HALLUCINATION: Do not infer, extrapolate, or add external knowledge.
3. CROSS-LINKS: In the Connections section, identify related topics mentioned in the source. Use [[Topic Name]] syntax.
4. OUTPUT FORMAT: Return only valid JSON (no fences):

{
  "title": "Exact topic title",
  "summary": "2-3 sentence summary for quick recall (source facts only)",
  "key_facts": ["fact 1", "fact 2", "fact 3"],
  "connections": [
    {"topic": "Related Topic Name", "relationship": "one-line relationship description"}
  ],
  "memory_hooks": ["mnemonic or pattern that helps remember key facts"],
  "tags": ["tag1", "tag2", "tag3"],
  "quick_revision": ["bullet point 1", "bullet point 2"]
}

IMPORTANT:
- key_facts: 5-15 concise, exam-ready bullet points
- connections: topics explicitly mentioned or clearly linked in the source text
- memory_hooks: mnemonics, acronyms, patterns (only if the source supports them)
- quick_revision: 3-7 summary bullets for last-minute review
- tags: 3-7 lowercase keywords describing the topic
"""


async def _compile_page_with_ai(
    title: str,
    subject: str,
    chunks: list[dict],
    existing_body: Optional[str] = None,
) -> Optional[dict]:
    """
    Call the LLM to compile/update a wiki page from the given chunks.
    Returns parsed JSON dict or None on failure.
    """
    # Build context from chunks (capped to ~8K chars)
    context_parts = []
    total_chars = 0
    for chunk in chunks:
        content = chunk.get("content", "").strip()
        if content and total_chars < 8000:
            subtopic = chunk.get("subtopic", "")
            header = f"[{subtopic}]" if subtopic else ""
            context_parts.append(f"{header}\n{content}")
            total_chars += len(content)

    if not context_parts:
        return None

    context = "\n\n---\n\n".join(context_parts)

    # Include existing page body so AI can MERGE, not replace
    existing_note = ""
    if existing_body:
        existing_note = (
            f"\n\nEXISTING WIKI PAGE (merge new facts into this, do not lose old facts):\n"
            f"---\n{existing_body[:3000]}\n---\n"
        )

    prompt = (
        f"TOPIC: {title}\nSUBJECT: {subject}\n\n"
        f"SOURCE CHUNKS:\n---\n{context}\n---\n"
        f"{existing_note}"
        f"\nCompile the structured wiki page JSON now."
    )

    try:
        resp = await generate_text(
            prompt, system_prompt=WIKI_COMPILE_SYSTEM, json_mode=True, temperature=0.15
        )
        # Strip markdown fences if present
        cleaned = resp.strip()
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).rstrip("`").strip()
        data = json.loads(cleaned)
        # Validate required fields
        if not data.get("title") or not data.get("key_facts"):
            logger.warning(f"[WikiCompiler] AI returned incomplete data for '{title}'")
            return None
        return data
    except Exception as e:
        logger.warning(f"[WikiCompiler] AI compilation failed for '{title}': {e}")
        return None


def _render_wiki_page(meta: dict, data: dict) -> str:
    """Render a wiki page from frontmatter meta + AI-compiled data dict."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta["last_compiled"] = now

    fm = _build_frontmatter(meta)

    key_facts = "\n".join(f"- {f}" for f in data.get("key_facts", []))
    connections = "\n".join(
        f"- [[{c['topic']}]] — {c.get('relationship', '')}"
        for c in data.get("connections", [])
        if c.get("topic")
    )
    memory_hooks = "\n".join(f"- {h}" for h in data.get("memory_hooks", []))
    quick_revision = "\n".join(f"- {b}" for b in data.get("quick_revision", []))
    sources_list = "\n".join(f"- {s}" for s in meta.get("sources", []))

    body = f"""
## Summary
{data.get("summary", "")}

## Key Facts
{key_facts}

## Connections
{connections or "_No cross-links identified yet._"}

## Memory Hooks
{memory_hooks or "_No memory aids available._"}

## Quick Revision
{quick_revision}

## Sources
{sources_list or "_Unknown_"}
""".strip()

    return f"{fm}\n\n{body}\n"


# ─────────────────────────────────────────────────────────────────────────────
# Index management
# ─────────────────────────────────────────────────────────────────────────────


def _update_index(
    index: dict,
    subject: str,
    title: str,
    slug: str,
    tags: list[str],
    connections: list[dict],
    sources: list[str],
) -> dict:
    """Update the wiki index with a compiled page and its graph edges."""
    page_id = f"{_slugify(subject)}/{slug}"

    # Upsert page entry
    existing_page = next((p for p in index["pages"] if p["id"] == page_id), None)
    if existing_page:
        existing_page.update(
            {
                "title": title,
                "subject": subject,
                "slug": slug,
                "tags": tags,
                "sources": list(set(existing_page.get("sources", []) + sources)),
                "last_compiled": datetime.now(timezone.utc).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                ),
            }
        )
    else:
        index["pages"].append(
            {
                "id": page_id,
                "title": title,
                "subject": subject,
                "slug": slug,
                "tags": tags,
                "sources": sources,
                "last_compiled": datetime.now(timezone.utc).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                ),
            }
        )

    # Update graph edges (connections)
    # Remove old edges FROM this page
    index["edges"] = [e for e in index["edges"] if e.get("from") != page_id]
    # Add new edges
    for conn in connections:
        target_title = conn.get("topic", "")
        if target_title:
            target_id = f"{_slugify(subject)}/{_slugify(target_title)}"
            index["edges"].append(
                {
                    "from": page_id,
                    "to": target_id,
                    "from_title": title,
                    "to_title": target_title,
                    "label": conn.get("relationship", "related"),
                }
            )

    return index


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────


async def compile_wiki_from_ingestion(
    subject: str,
    topic: str,
    source_name: str,
    subtopic_chunks: list[dict],
    formatted_chapters: list[dict],
) -> dict:
    """
    Main entry point called after each ingestion.
    Groups subtopic chunks by chapter/subtopic and compiles wiki pages.

    Returns:
        {
            "pages_created": int,
            "pages_updated": int,
            "pages": [{"title": str, "subject": str, "path": str}]
        }
    """
    WIKI_DIR.mkdir(parents=True, exist_ok=True)
    index = _load_index()

    pages_created = 0
    pages_updated = 0
    compiled_pages = []

    # Group chunks by chapter_title to create one wiki page per chapter
    chapters_map: dict[str, list[dict]] = {}
    for chunk in subtopic_chunks:
        ch_title = chunk.get("chapter_title", topic)
        chapters_map.setdefault(ch_title, []).append(chunk)

    # If no subtopic chunks, use formatted_chapters as fallback
    if not chapters_map and formatted_chapters:
        for ch in formatted_chapters:
            title = ch.get("title", topic)
            chapters_map[title] = [
                {"content": ch.get("content", ""), "subtopic": title}
            ]

    # First pass: prepare work items (file I/O, can't parallelize)
    work_items = []
    for chapter_title, chunks in chapters_map.items():
        page_path = _wiki_page_path(subject, chapter_title)
        slug = _slugify(chapter_title)

        existing_meta: dict = {}
        existing_body: Optional[str] = None
        if page_path.exists():
            try:
                existing_content = page_path.read_text(encoding="utf-8")
                existing_meta, existing_body = _parse_frontmatter(existing_content)
            except Exception:
                pass

        work_items.append(
            {
                "chapter_title": chapter_title,
                "chunks": chunks,
                "slug": slug,
                "page_path": page_path,
                "existing_meta": existing_meta,
                "existing_body": existing_body,
            }
        )

    # Second pass: run all LLM calls in parallel
    async def _compile_one(item: dict) -> tuple[dict, Optional[dict]]:
        data = await _compile_page_with_ai(
            title=item["chapter_title"],
            subject=subject,
            chunks=item["chunks"],
            existing_body=item["existing_body"],
        )
        return item, data

    results = await asyncio.gather(*[_compile_one(item) for item in work_items])

    # Third pass: save files and update index sequentially (file I/O must be ordered)
    for item, compiled_data in results:
        chapter_title = item["chapter_title"]
        chunks = item["chunks"]
        slug = item["slug"]
        page_path = item["page_path"]
        existing_meta = item["existing_meta"]
        existing_body = item["existing_body"]

        if existing_body is not None:
            pages_updated += 1
        else:
            pages_created += 1

        if not compiled_data:
            logger.warning(
                f"[WikiCompiler] Skipping AI for '{chapter_title}' — using fallback content"
            )
            raw_content = "\n\n".join([c.get("content", "") for c in chunks])
            compiled_data = {
                "title": chapter_title,
                "summary": "AI compilation failed. Showing raw extracted text.",
                "key_facts": ["Raw content included below"],
                "connections": [],
                "memory_hooks": [],
                "quick_revision": ["Raw content fallback"],
            }
            compiled_data["summary"] += "\n\n" + raw_content[:4000]

        existing_sources = existing_meta.get("sources", [])
        if isinstance(existing_sources, str):
            existing_sources = [existing_sources]
        all_sources = list(set(existing_sources + [source_name]))

        existing_related = existing_meta.get("related", [])
        if isinstance(existing_related, str):
            existing_related = [existing_related]
        new_related = [
            c["topic"] for c in compiled_data.get("connections", []) if c.get("topic")
        ]
        merged_related = _merge_related(existing_related, new_related)

        meta = {
            "title": compiled_data.get("title", chapter_title),
            "subject": subject,
            "topic": topic,
            "tags": compiled_data.get("tags", []),
            "related": merged_related,
            "sources": all_sources,
        }

        page_content = _render_wiki_page(meta, compiled_data)
        try:
            page_path.write_text(page_content, encoding="utf-8")
            logger.info(f"[WikiCompiler] Saved wiki page: {page_path.name}")
        except Exception as e:
            logger.error(f"[WikiCompiler] Failed to save '{chapter_title}': {e}")
            continue

        index = _update_index(
            index=index,
            subject=subject,
            title=compiled_data.get("title", chapter_title),
            slug=slug,
            tags=compiled_data.get("tags", []),
            connections=compiled_data.get("connections", []),
            sources=all_sources,
        )

        compiled_pages.append(
            {
                "title": compiled_data.get("title", chapter_title),
                "subject": subject,
                "slug": slug,
                "path": str(page_path.relative_to(KB_DIR)),
            }
        )

        if not compiled_data:
            logger.warning(
                f"[WikiCompiler] Skipping AI for '{chapter_title}' — using fallback content"
            )
            # Fallback to simple content when AI fails (e.g. rate limit)
            raw_content = "\n\n".join([c.get("content", "") for c in chunks])
            compiled_data = {
                "title": chapter_title,
                "summary": "AI compilation failed. Showing raw extracted text.",
                "key_facts": ["Raw content included below"],
                "connections": [],
                "memory_hooks": [],
                "quick_revision": ["Raw content fallback"],
            }
            # Append raw content to summary so it's not empty
            compiled_data["summary"] += "\n\n" + raw_content[:4000]

        # Build/update frontmatter
        existing_sources = existing_meta.get("sources", [])
        if isinstance(existing_sources, str):
            existing_sources = [existing_sources]
        all_sources = list(set(existing_sources + [source_name]))

        existing_related = existing_meta.get("related", [])
        if isinstance(existing_related, str):
            existing_related = [existing_related]
        new_related = [
            c["topic"] for c in compiled_data.get("connections", []) if c.get("topic")
        ]
        merged_related = _merge_related(existing_related, new_related)

        meta = {
            "title": compiled_data.get("title", chapter_title),
            "subject": subject,
            "topic": topic,
            "tags": compiled_data.get("tags", []),
            "related": merged_related,
            "sources": all_sources,
        }

        # Render and save wiki page
        page_content = _render_wiki_page(meta, compiled_data)
        try:
            page_path.write_text(page_content, encoding="utf-8")
            logger.info(f"[WikiCompiler] Saved wiki page: {page_path.name}")
        except Exception as e:
            logger.error(f"[WikiCompiler] Failed to save '{chapter_title}': {e}")
            continue

        # Update index
        index = _update_index(
            index=index,
            subject=subject,
            title=compiled_data.get("title", chapter_title),
            slug=slug,
            tags=compiled_data.get("tags", []),
            connections=compiled_data.get("connections", []),
            sources=all_sources,
        )

        compiled_pages.append(
            {
                "title": compiled_data.get("title", chapter_title),
                "subject": subject,
                "slug": slug,
                "path": str(page_path.relative_to(KB_DIR)),
            }
        )

    # Save updated index
    _save_index(index)

    logger.info(
        f"[WikiCompiler] Done — {pages_created} created, {pages_updated} updated "
        f"for {subject}/{topic}"
    )

    return {
        "pages_created": pages_created,
        "pages_updated": pages_updated,
        "pages": compiled_pages,
    }


def get_wiki_index() -> dict:
    """Return the full wiki index for the frontend graph explorer."""
    return _load_index()


def get_wiki_page(subject: str, slug: str) -> Optional[dict]:
    """
    Return a wiki page's content and metadata by subject + slug.
    Returns None if not found.
    """
    page_path = WIKI_DIR / _slugify(subject) / f"{_slugify(slug)}.md"
    if not page_path.exists():
        return None
    try:
        content = page_path.read_text(encoding="utf-8")
        meta, body = _parse_frontmatter(content)
        return {
            "title": meta.get("title", slug),
            "subject": meta.get("subject", subject),
            "tags": meta.get("tags", []),
            "related": meta.get("related", []),
            "sources": meta.get("sources", []),
            "last_compiled": meta.get("last_compiled", ""),
            "body": body,
            "raw": content,
        }
    except Exception as e:
        logger.error(f"[WikiCompiler] Failed to read page {subject}/{slug}: {e}")
        return None


def list_wiki_pages(subject: Optional[str] = None) -> list[dict]:
    """List all wiki pages, optionally filtered by subject."""
    index = _load_index()
    pages = index.get("pages", [])
    if subject:
        pages = [p for p in pages if p.get("subject", "").lower() == subject.lower()]
    return pages
