# ─────────────────────────────────────────────────────────────────────────────
# backend/graphs/ingestion_graph.py
# LangGraph-native ingestion state machine — 10-node pipeline (v3).
#
# Pipeline:
#  1. save_raw_clean      → Text cleanup FIRST (hyphens, OCR artifacts, control chars)
#  2. analyze_structure   → AI reads cleaned text (stratified sampling ~16K chars)
#  3. semantic_split      → Split at semantic boundaries using structural map
#  4. generate_toc        → Build TOC from structural map
#  5. semantic_tag        → Assign chunks to chapters/subtopics via offset map
#  6. assemble_chapters   → Group chunks; COMPLETENESS GATE (≥92%)
#  7. format_chapters     → AI formats + splits into subtopic chunks
#  8. save_to_chroma      → Upsert subtopic-level chunks into ChromaDB
#  9. compile_wiki_pages  → AI compiles/updates wiki entity pages (Karpathy pattern)
# ─────────────────────────────────────────────────────────────────────────────
import json
import logging
import operator
import re
import unicodedata
from typing import Annotated, Any, TypedDict

from langgraph.graph import StateGraph, END

from core.llm import generate_text
from vectorstore.chroma_store import upsert_chunks
from parsers.structure_extractor import HeuristicStructureExtractor

logger = logging.getLogger(__name__)

_progress_callback = None


def set_progress_callback(cb):
    global _progress_callback
    _progress_callback = cb


def clear_progress_callback():
    global _progress_callback
    _progress_callback = None


async def _report_progress(node: str, pct: int, status: str = "running"):
    cb = _progress_callback
    if cb:
        await cb(node, pct, status)


# ─────────────────────────────────────────────────────────────────────────────
# State Schema
# ─────────────────────────────────────────────────────────────────────────────


class IngestionState(TypedDict, total=False):
    # Inputs
    raw_text: str
    subject: str
    topic: str
    source_name: str

    # Node 1 output: save_raw_clean
    raw_clean_text: str

    # Node 2 output: analyze_structure
    structural_map: dict  # {chapters: [{title, start, end, subtopics: [{title, start, end}]}], doc_type, key_themes, glossary}
    document_type: str
    key_themes: list[str]
    glossary_terms: list[str]

    # Node 3 output: semantic_split
    semantic_chunks: list[dict]  # [{text, chapter_idx, subtopic_idx, context}]

    # Node 4 output: generate_toc
    chapter_titles: list[str]
    global_context: str
    toc_with_subtopics: list[dict]  # [{title, subtopics: [str]}]

    # Node 5 output: semantic_tag
    tagged_chunks: list[dict]  # [{chapter_idx, subtopic_idx, text, context}]

    # Node 6 output
    raw_chapters: list[
        dict
    ]  # [{title, subtopic_groups: [{subtopic_title, raw_content}]}]
    completeness_score: float

    # Node 7 output
    formatted_chapters: list[dict]  # [{title, content}]
    subtopic_chunks: list[dict]  # [{chapter_title, subtopic_title, content}]

    # Node 8 output
    chunks_saved: int

    # Node 9 output
    wiki_result: dict | None

    # Error log — Annotated with operator.add so errors ACCUMULATE
    errors: Annotated[list[str], operator.add]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _safe_parse_json(text: str) -> Any:
    """Strip markdown fences and parse JSON."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).rstrip("```").strip()
    return json.loads(cleaned)


def _clean_text(raw: str) -> str:
    """
    Deterministic text cleanup:
    - Fix broken hyphenations at line endings (exam-\nple → example)
    - Strip control characters (keep \n, \t, \r)
    - Normalize Unicode (NFKC for OCR normalization)
    - Collapse 3+ blank lines into 2
    - Strip leading/trailing whitespace
    """
    text = unicodedata.normalize("NFKC", raw)
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # broken hyphenation
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)  # control chars
    text = re.sub(r"\n{4,}", "\n\n\n", text)  # collapse excessive blank lines
    return text.strip()


def _score_text_for_title(text: str, title: str) -> float:
    """Keyword-overlap score (pure Python, zero LLM)."""
    stop = {
        "the",
        "a",
        "an",
        "of",
        "and",
        "or",
        "in",
        "on",
        "at",
        "to",
        "for",
        "with",
        "by",
        "from",
        "is",
        "was",
        "are",
        "were",
        "be",
    }
    title_tokens = {
        w.lower()
        for w in re.findall(r"\b\w+\b", title)
        if w.lower() not in stop and len(w) > 2
    }
    if not title_tokens:
        return 0.0
    text_lower = text.lower()
    hits = sum(1 for t in title_tokens if t in text_lower)
    return hits / len(title_tokens)


def _split_at_subtopic_headers(
    formatted_content: str, chapter_title: str
) -> list[dict]:
    """
    Scan formatted Markdown for ## subtopic headers and split into subtopic chunks.
    Falls back to single chapter-level chunk if no subtopic headers found.
    """
    lines = formatted_content.split("\n")
    subtopic_groups: list[dict] = []
    current_subtopic: str | None = None
    current_lines: list[str] = []

    for line in lines:
        if line.startswith("## ") and not line.startswith("### "):
            if current_subtopic is not None and current_lines:
                subtopic_groups.append(
                    {
                        "chapter_title": chapter_title,
                        "subtopic_title": current_subtopic,
                        "content": "\n".join(current_lines).strip(),
                    }
                )
            current_subtopic = line[3:].strip()
            current_lines = [line]
        else:
            current_lines.append(line)

    if current_subtopic is not None and current_lines:
        subtopic_groups.append(
            {
                "chapter_title": chapter_title,
                "subtopic_title": current_subtopic,
                "content": "\n".join(current_lines).strip(),
            }
        )

    if not subtopic_groups:
        subtopic_groups.append(
            {
                "chapter_title": chapter_title,
                "subtopic_title": chapter_title,
                "content": formatted_content,
            }
        )

    return [g for g in subtopic_groups if g["content"]]


def _build_fallback_structure(raw: str) -> dict:
    """Build a minimal structural map when AI analysis fails."""
    return {
        "chapters": [
            {"title": "Full Document", "start": 0, "end": len(raw), "subtopics": []}
        ],
        "document_type": "unknown",
        "key_themes": [],
        "glossary_terms": [],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Graph Nodes
# ─────────────────────────────────────────────────────────────────────────────


async def analyze_structure(state: IngestionState) -> dict:
    """
    Node 2: Extracts hierarchical structure, chapter boundaries, subtopics,
    document type, key themes, and glossary terms using a robust, zero-LLM local heuristic parser.
    """
    await _report_progress("analyze_structure", 8)
    cleaned = state.get("raw_clean_text", state.get("raw_text", ""))

    try:
        result = HeuristicStructureExtractor.extract_structure(cleaned)
        logger.info(
            f"[Node 2] Heuristic Structure Extraction Successful: "
            f"{len(result['chapters'])} chapters found, type={result['document_type']}"
        )
        return {
            "structural_map": result,
            "document_type": result["document_type"],
            "key_themes": result["key_themes"],
            "glossary_terms": result["glossary_terms"],
        }
    except Exception as e:
        logger.error(
            f"[Node 2] Heuristic extraction failed, using minimal fallback: {e}"
        )
        doc_len = len(cleaned)
        fallback = {
            "chapters": [
                {"title": "Full Document", "start": 0, "end": doc_len, "subtopics": []}
            ],
            "document_type": "textbook_chapter",
            "key_themes": ["Overview"],
            "glossary_terms": [],
        }
        return {
            "structural_map": fallback,
            "document_type": fallback["document_type"],
            "key_themes": fallback["key_themes"],
            "glossary_terms": fallback["glossary_terms"],
            "errors": [f"analyze_structure: Heuristic extraction failed: {str(e)}"],
        }


async def save_raw_clean(state: IngestionState) -> dict:
    """Node 1: Clean text artifacts — fix hyphens, OCR errors, control characters. Runs FIRST so downstream nodes work with clean text."""
    await _report_progress("save_raw_clean", 2)
    raw = state.get("raw_text", "")
    cleaned = _clean_text(raw)
    chars_removed = len(raw) - len(cleaned)
    logger.info(
        f"[Node 2] Cleaned text: {len(cleaned):,} chars ({chars_removed:+,} chars removed)"
    )
    return {"raw_clean_text": cleaned}


async def semantic_split(state: IngestionState) -> dict:
    """
    Node 3: Split document at semantic boundaries using the structural map.
    Each chunk carries its chapter/subtopic context from the start.
    Falls back to paragraph splitting if structure analysis failed.
    """
    await _report_progress("semantic_split", 15)
    raw = state.get("raw_clean_text", state.get("raw_text", ""))
    structural_map = state.get("structural_map", {})
    chapters = structural_map.get("chapters", [])

    has_structure = len(chapters) > 1 or (
        len(chapters) == 1 and chapters[0].get("subtopics")
    )

    if has_structure:
        chunks = []
        for ci, chapter in enumerate(chapters):
            start = chapter.get("start", 0)
            end = chapter.get("end", len(raw))
            chapter_text = raw[start:end]

            subtopics = chapter.get("subtopics", [])
            if subtopics:
                for si, sub in enumerate(subtopics):
                    sub_start = sub.get("start", 0)
                    sub_end = sub.get("end", len(raw))
                    sub_text = raw[sub_start:sub_end]
                    if sub_text.strip():
                        chunks.append(
                            {
                                "text": sub_text.strip(),
                                "chapter_idx": ci,
                                "subtopic_idx": si,
                                "context": f"{chapter['title']} > {sub['title']}",
                            }
                        )
            else:
                if chapter_text.strip():
                    chunks.append(
                        {
                            "text": chapter_text.strip(),
                            "chapter_idx": ci,
                            "subtopic_idx": -1,
                            "context": chapter["title"],
                        }
                    )

        logger.info(
            f"[Node 3] Semantic split: {len(chunks)} chunks from structural map"
        )
        return {"semantic_chunks": chunks}

    # Fallback: paragraph splitting with positional assignment
    paras = [p.strip() for p in re.split(r"\n{2,}", raw) if p.strip()]
    num_chapters = max(len(chapters), 1)
    chunks = []
    for i, para in enumerate(paras):
        ci = (
            min(int(i / len(paras) * num_chapters), num_chapters - 1)
            if len(paras) > 0
            else 0
        )
        chapter_title = chapters[ci]["title"] if ci < len(chapters) else "Full Document"
        chunks.append(
            {
                "text": para,
                "chapter_idx": ci,
                "subtopic_idx": -1,
                "context": chapter_title,
            }
        )

    logger.info(f"[Node 3] Fallback paragraph split: {len(chunks)} chunks")
    return {"semantic_chunks": chunks}


async def generate_toc(state: IngestionState) -> dict:
    """
    Node 4: Build TOC directly from the structural map.
    No stratified sampling — uses full-document analysis from Node 1.
    """
    await _report_progress("generate_toc", 18)
    structural_map = state.get("structural_map", {})
    chapters = structural_map.get("chapters", [])

    chapter_titles = [
        c["title"].strip() for c in chapters if c.get("title", "").strip()
    ]
    if not chapter_titles:
        chapter_titles = ["Complete Study Notes"]

    toc_with_subtopics = []
    for c in chapters:
        subtopics = c.get("subtopics", [])
        toc_with_subtopics.append(
            {
                "title": c["title"],
                "subtopics": [
                    s["title"] for s in subtopics if s.get("title", "").strip()
                ],
            }
        )

    key_themes = state.get("key_themes", [])
    glossary = state.get("glossary_terms", [])
    context_parts = []
    if key_themes:
        context_parts.append(f"Key themes: {', '.join(key_themes)}")
    if glossary:
        context_parts.append(f"Important terms: {', '.join(glossary[:10])}")
    global_context = (
        " | ".join(context_parts) if context_parts else "Academic study material."
    )

    logger.info(f"[Node 4] TOC generated: {chapter_titles}")
    return {
        "chapter_titles": chapter_titles,
        "global_context": global_context,
        "toc_with_subtopics": toc_with_subtopics,
    }


async def semantic_tag(state: IngestionState) -> dict:
    """
    Node 5: Assign each chunk to its chapter/subtopic using offset boundaries.
    Uses character offsets from structural map for deterministic assignment.
    Falls back to keyword scoring for ambiguous chunks.
    """
    await _report_progress("semantic_tag", 20)
    chunks = state.get("semantic_chunks", [])
    structural_map = state.get("structural_map", {})
    chapters = structural_map.get("chapters", [])

    if not chapters:
        tagged = [{**c, "chapter_idx": 0, "subtopic_idx": -1} for c in chunks]
        return {"tagged_chunks": tagged}

    tagged = []
    for chunk in chunks:
        ci = chunk.get("chapter_idx", 0)
        si = chunk.get("subtopic_idx", -1)

        if 0 <= ci < len(chapters):
            chapter = chapters[ci]
            subtopics = chapter.get("subtopics", [])

            if si >= 0 and si < len(subtopics):
                tagged.append(
                    {
                        "chapter_idx": ci,
                        "subtopic_idx": si,
                        "text": chunk["text"],
                        "context": f"{chapter['title']} > {subtopics[si]['title']}",
                    }
                )
            else:
                tagged.append(
                    {
                        "chapter_idx": ci,
                        "subtopic_idx": -1,
                        "text": chunk["text"],
                        "context": chapter["title"],
                    }
                )
        else:
            tagged.append(
                {
                    "chapter_idx": 0,
                    "subtopic_idx": -1,
                    "text": chunk["text"],
                    "context": chapters[0]["title"] if chapters else "Full Document",
                }
            )

    logger.info(f"[Node 5] Tagged {len(tagged)} chunks using structural offsets")
    return {"tagged_chunks": tagged}


async def assemble_chapters(state: IngestionState) -> dict:
    """
    Node 6: Group tagged chunks by chapter and subtopic.
    COMPLETENESS GATE: ≥92% of chars must be preserved.
    """
    await _report_progress("assemble_chapters", 25)
    tagged = state.get("tagged_chunks", [])
    toc = state.get("toc_with_subtopics", [])
    raw = state.get("raw_clean_text", state.get("raw_text", ""))

    chapter_titles = (
        [t["title"] for t in toc]
        if toc
        else state.get("chapter_titles", ["Complete Study Notes"])
    )

    groups: dict[int, dict[int, list[str]]] = {}
    for ci in range(len(chapter_titles)):
        groups[ci] = {}

    for item in tagged:
        ci = item["chapter_idx"]
        si = item["subtopic_idx"]
        if ci not in groups:
            groups[ci] = {}
        if si not in groups[ci]:
            groups[ci][si] = []
        groups[ci][si].append(item["text"])

    raw_chapters = []
    total_chars = 0
    for ci, title in enumerate(chapter_titles):
        subtopic_groups = []
        if ci in groups:
            for si, texts in sorted(groups[ci].items()):
                content = "\n\n".join(texts)
                if content.strip():
                    sub_name = ""
                    if (
                        toc
                        and ci < len(toc)
                        and toc[ci].get("subtopics")
                        and 0 <= si < len(toc[ci]["subtopics"])
                    ):
                        sub_name = toc[ci]["subtopics"][si]
                    elif si == -1:
                        sub_name = title
                    else:
                        sub_name = f"Part {si + 1}"
                    subtopic_groups.append(
                        {"subtopic_title": sub_name, "raw_content": content}
                    )
                    total_chars += len(content)

        if subtopic_groups:
            raw_chapters.append({"title": title, "subtopic_groups": subtopic_groups})

    total_char_count = sum(len(item["text"]) for item in tagged)
    score = total_chars / total_char_count if total_char_count > 0 else 1.0

    logger.info(
        f"[Node 6] Completeness: {score:.1%} ({total_chars}/{total_char_count})"
    )

    if score < 0.92:
        logger.warning(f"[Node 6] GATE TRIGGERED — falling back to single chapter")
        raw_chapters = [
            {
                "title": chapter_titles[0],
                "subtopic_groups": [
                    {"subtopic_title": chapter_titles[0], "raw_content": raw}
                ],
            }
        ]
        score = 1.0

    return {"raw_chapters": raw_chapters, "completeness_score": score}


async def format_chapters(state: IngestionState) -> dict:
    """
    Node 7: Rule-based fast formatter that builds chapter notes and splits
    them into subtopic-level chunks deterministically in Python.
    Bypasses expensive AI LLM formatting to achieve near-instant execution (<5ms).
    """
    await _report_progress("format_chapters", 30)
    raw_chapters = state.get("raw_chapters", [])
    formatted: list[dict] = []
    all_subtopic_chunks: list[dict] = []

    for chapter in raw_chapters:
        title = chapter["title"]
        subtopic_groups = chapter.get("subtopic_groups", [])

        if not subtopic_groups:
            continue

        # Deterministically compile chapter markdown text
        markdown_parts = [f"# {title}\n"]
        chapter_sub_chunks = []

        for sg in subtopic_groups:
            sub_title = sg["subtopic_title"]
            raw_content = sg["raw_content"].strip()

            if not raw_content:
                continue

            markdown_parts.append(f"## {sub_title}\n{raw_content}\n")

            # Map chunk for vector store
            chapter_sub_chunks.append(
                {
                    "chapter_title": title,
                    "subtopic_title": sub_title,
                    "content": raw_content,
                }
            )

        full_content = "\n".join(markdown_parts)
        formatted.append({"title": title, "content": full_content})
        all_subtopic_chunks.extend(chapter_sub_chunks)

        logger.info(
            f"[Node 7] Formatted chapter '{title}' deterministically → {len(chapter_sub_chunks)} subtopics"
        )

    logger.info(
        f"[Node 7] Rule-based format complete: {len(formatted)} chapters, {len(all_subtopic_chunks)} total subtopics"
    )
    return {"formatted_chapters": formatted, "subtopic_chunks": all_subtopic_chunks}


async def save_to_chroma(state: IngestionState) -> dict:
    """Node 8: Upsert subtopic-level chunks into ChromaDB."""
    await _report_progress("save_to_chroma", 35)
    subtopic_chunks = state.get("subtopic_chunks", [])
    subject = state.get("subject", "General")
    topic = state.get("topic", "Imported Material")
    source = state.get("source_name", "unknown")

    chunks = []
    for sc in subtopic_chunks:
        content = sc.get("content", "").strip()
        if not content:
            continue
        chunks.append(
            {
                "title": sc.get("chapter_title", topic),
                "content": content,
                "subtopic": sc.get("subtopic_title", ""),
            }
        )

    if not chunks:
        logger.warning("[Node 8] No subtopic chunks to save")
        return {"chunks_saved": 0}

    try:
        # Sync to local markdown binder file (Single Source of Truth)
        try:
            import os
            binders_dir = os.path.join("knowledge_base", "binders")
            os.makedirs(binders_dir, exist_ok=True)
            filepath = os.path.join(binders_dir, f"{subject}.md")

            existing_content = ""
            if os.path.exists(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    existing_content = f.read().strip()

            if not existing_content:
                existing_content = f"# Subject: {subject}"

            new_chapters_markdown = ""
            chapters_dict = {}
            for sc in subtopic_chunks:
                ch_title = sc.get("chapter_title", topic)
                if ch_title not in chapters_dict:
                    chapters_dict[ch_title] = []
                chapters_dict[ch_title].append(sc)

            for ch_title, subs in sorted(chapters_dict.items()):
                clean_ch_title = ch_title
                if clean_ch_title.startswith("Topic:"):
                    clean_ch_title = clean_ch_title.replace("Topic:", "").strip()
                new_chapters_markdown += f"\n\n## Topic: {clean_ch_title}\n"
                new_chapters_markdown += f"* **Sources**: {source}\n\n"
                for sub in subs:
                    sub_title = sub.get("subtopic_title", "")
                    sub_content = sub.get("content", "").strip()
                    if sub_content:
                        new_chapters_markdown += f"### {sub_title}\n{sub_content}\n\n"
                new_chapters_markdown += "---\n"

            updated_content = existing_content + new_chapters_markdown
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(updated_content.strip() + "\n")

            logger.info(f"[Ingestion File Sync] Synced {len(chapters_dict)} chapters to local binder file '{filepath}'")
        except Exception as file_err:
            logger.error(f"[Ingestion File Sync] Failed to write binder file: {file_err}")

        count = await upsert_chunks(chunks, subject, topic, source)
        logger.info(f"[Node 8] Saved {count} subtopic chunks to ChromaDB")
        await _report_progress("save_to_chroma", 65, status="success")
        return {"chunks_saved": count}
    except Exception as e:
        logger.error(f"[Node 8] ChromaDB upsert failed: {e}")
        await _report_progress("save_to_chroma", 35, status="failed")
        return {"chunks_saved": 0, "errors": [f"save_to_chroma: {e}"]}


async def compile_wiki_pages(state: IngestionState) -> dict:
    """
    Node 9: Compile/update wiki entity pages from the ingested subtopic chunks.

    Implements Karpathy's LLM Wiki pattern — after each ingestion, the AI
    synthesizes structured, cross-linked Markdown pages in knowledge_base/wiki/.
    These pages are human-readable, compound with each ingestion, and serve as
    a pre-compiled knowledge layer above raw ChromaDB chunks.

    Failure-safe: wiki compilation failure never blocks ingestion completion.
    """
    await _report_progress("compile_wiki_pages", 70)
    subtopic_chunks = state.get("subtopic_chunks", [])
    formatted_chapters = state.get("formatted_chapters", [])
    subject = state.get("subject", "General")
    topic = state.get("topic", "Imported Material")
    source_name = state.get("source_name", "unknown")

    try:
        from wiki.wiki_compiler import compile_wiki_from_ingestion

        result = await compile_wiki_from_ingestion(
            subject=subject,
            topic=topic,
            source_name=source_name,
            subtopic_chunks=subtopic_chunks,
            formatted_chapters=formatted_chapters,
        )
        logger.info(
            f"[Node 9] Wiki: {result['pages_created']} created, "
            f"{result['pages_updated']} updated for {subject}/{topic}"
        )
        await _report_progress("compile_wiki_pages", 100, status="success")
        return {"wiki_result": result}
    except Exception as e:
        logger.warning(f"[Node 9] Wiki compilation failed (non-critical): {e}")
        await _report_progress("compile_wiki_pages", 70, status="failed")
        return {"wiki_result": None, "errors": [f"compile_wiki_pages: {e}"]}


# ─────────────────────────────────────────────────────────────────────────────
# Graph Builder
# ─────────────────────────────────────────────────────────────────────────────


def build_ingestion_graph():
    g = StateGraph(IngestionState)

    g.add_node("save_raw_clean", save_raw_clean)
    g.add_node("analyze_structure", analyze_structure)
    g.add_node("semantic_split", semantic_split)
    g.add_node("generate_toc", generate_toc)
    g.add_node("semantic_tag", semantic_tag)
    g.add_node("assemble_chapters", assemble_chapters)
    g.add_node("format_chapters", format_chapters)
    g.add_node("save_to_chroma", save_to_chroma)
    g.add_node("compile_wiki_pages", compile_wiki_pages)

    g.set_entry_point("save_raw_clean")
    g.add_edge("save_raw_clean", "analyze_structure")
    g.add_edge("analyze_structure", "semantic_split")
    g.add_edge("semantic_split", "generate_toc")
    g.add_edge("generate_toc", "semantic_tag")
    g.add_edge("semantic_tag", "assemble_chapters")
    g.add_edge("assemble_chapters", "format_chapters")
    g.add_edge("format_chapters", "save_to_chroma")
    g.add_edge("save_to_chroma", "compile_wiki_pages")
    g.add_edge("compile_wiki_pages", END)

    return g.compile()


# Singleton — compiled once at import time
ingestion_graph = build_ingestion_graph()


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────


async def run_ingestion(
    raw_text: str,
    subject: str,
    topic: str,
    source_name: str,
    progress_callback=None,
) -> dict:
    """Run the full 9-node ingestion pipeline and return a result summary."""
    initial: IngestionState = {
        "raw_text": raw_text.strip(),
        "subject": subject.strip(),
        "topic": topic.strip(),
        "source_name": source_name.strip(),
        "errors": [],
    }

    if progress_callback:
        set_progress_callback(progress_callback)
    try:
        final = await ingestion_graph.ainvoke(initial)
    finally:
        clear_progress_callback()

    return {
        "chapters": final.get("formatted_chapters", []),
        "subtopic_chunks": final.get("subtopic_chunks", []),
        "chunks_saved": final.get("chunks_saved", 0),
        "completeness_score": final.get("completeness_score", 0.0),
        "wiki_result": final.get("wiki_result"),
        "errors": final.get("errors", []),
        "document_type": final.get("document_type", "unknown"),
        "key_themes": final.get("key_themes", []),
        "glossary_terms": final.get("glossary_terms", []),
    }
