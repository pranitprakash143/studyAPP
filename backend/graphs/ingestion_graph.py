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

logger = logging.getLogger(__name__)


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
    Node 2: AI reads CLEANED document (stratified sampling ~16K chars)
    and produces a hierarchical structural map with chapter boundaries,
    subtopics, document type, key themes, and glossary.

    Uses stratified sampling (beginning/middle/end) to avoid LLM timeout
    on large documents while still capturing full-document structure.
    Retries with smaller sample (~8K) if first attempt fails.
    """
    cleaned = state.get("raw_clean_text", state.get("raw_text", ""))
    source_name = state.get("source_name", "")

    system = (
        "You are a curriculum analyst and document structure expert.\n"
        "Analyze the provided document sample and produce a hierarchical structural map.\n\n"
        "RULES:\n"
        "1. Identify 2-8 distinct chapters based on thematic progression.\n"
        "2. For each chapter, identify 1-5 subtopics if the content supports it.\n"
        "3. Estimate approximate character offset boundaries (start, end) for each chapter and subtopic.\n"
        "4. Classify the document type: textbook_chapter, lecture_notes, exam_paper, research_paper, article, or other.\n"
        "5. Extract 3-8 key themes and 5-15 glossary terms (important terminology).\n"
        "6. NEVER use the source filename in chapter/subtopic titles.\n\n"
        "Output ONLY this JSON (no fences):\n"
        "{\n"
        '  "chapters": [\n'
        '    {"title": "Chapter Name", "start": 0, "end": 4200, "subtopics": [\n'
        '      {"title": "Subtopic Name", "start": 200, "end": 2100}\n'
        "    ]}\n"
        "  ],\n"
        '  "document_type": "textbook_chapter",\n'
        '  "key_themes": ["theme1", "theme2"],\n'
        '  "glossary_terms": ["Term1", "Term2"]\n'
        "}"
    )

    def _build_stratified_sample(text: str, sample_size: int) -> str:
        """Build a stratified sample from beginning, middle, and end of document."""
        n = len(text)
        if n <= sample_size:
            return text
        third = sample_size // 3
        return "\n\n".join(
            [
                "=== DOCUMENT BEGINNING ===",
                text[:third],
                "=== DOCUMENT MIDDLE ===",
                text[max(0, n // 2 - third // 2) : n // 2 + third // 2],
                "=== DOCUMENT END ===",
                text[max(0, n - third) :],
            ]
        )

    async def _attempt_analysis(sample: str, label: str) -> dict | None:
        """Single attempt to get structural map from LLM. Returns None on failure."""
        prompt = (
            f"DOCUMENT SAMPLE ({label}):\n---\n{sample}\n---\n"
            f'Source reference (do NOT use in titles): "{source_name}"\n'
            "Produce the structural map JSON now."
        )
        resp = await generate_text(
            prompt, system_prompt=system, json_mode=True, timeout=90
        )
        payload = _safe_parse_json(resp)
        chapters = payload.get("chapters", [])
        if not chapters:
            return None
        return {
            "chapters": chapters,
            "document_type": payload.get("document_type", "unknown"),
            "key_themes": payload.get("key_themes", []),
            "glossary_terms": payload.get("glossary_terms", []),
        }

    # Attempt 1: stratified sample ~16K chars
    try:
        sample = _build_stratified_sample(cleaned, 16_000)
        result = _attempt_analysis(sample, "16K char stratified sample")
        if result:
            chapter_count = len(result["chapters"])
            subtopic_count = sum(
                len(c.get("subtopics", [])) for c in result["chapters"]
            )
            logger.info(
                f"[Node 2] Structure: {chapter_count} chapters, {subtopic_count} subtopics, type={result['document_type']}"
            )
            return {
                "structural_map": result,
                "document_type": result["document_type"],
                "key_themes": result["key_themes"],
                "glossary_terms": result["glossary_terms"],
            }
    except Exception as e:
        logger.warning(f"[Node 2] Analysis attempt 1 (16K) failed: {e}")

    # Attempt 2: smaller sample ~8K chars
    try:
        sample = _build_stratified_sample(cleaned, 8_000)
        result = _attempt_analysis(sample, "8K char stratified sample")
        if result:
            chapter_count = len(result["chapters"])
            subtopic_count = sum(
                len(c.get("subtopics", [])) for c in result["chapters"]
            )
            logger.info(
                f"[Node 2] Structure (retry): {chapter_count} chapters, {subtopic_count} subtopics"
            )
            return {
                "structural_map": result,
                "document_type": result["document_type"],
                "key_themes": result["key_themes"],
                "glossary_terms": result["glossary_terms"],
                "errors": [f"analyze_structure: retry succeeded with smaller sample"],
            }
    except Exception as e:
        logger.warning(f"[Node 2] Analysis attempt 2 (8K) failed: {e}")

    # Fallback: pure Python structural analysis
    logger.warning("[Node 2] All AI analysis attempts failed — using Python fallback")
    fallback = _analyze_structure_python(cleaned)
    return {
        "structural_map": fallback["map"],
        "document_type": fallback["doc_type"],
        "key_themes": fallback["themes"],
        "glossary_terms": [],
        "errors": ["analyze_structure: AI unavailable, used Python heuristic analysis"],
    }


def _analyze_structure_python(text: str) -> dict:
    """
    Pure Python structural analysis fallback when AI is unavailable.
    Detects chapters by looking for ALL-CAPS lines, markdown headings,
    numbered sections, and common heading patterns.
    """
    chapters = []
    current_chapter: dict | None = None
    lines = text.split("\n")

    heading_patterns = [
        re.compile(r"^(#{1,3})\s+(.+)"),  # Markdown headings
        re.compile(r"^[A-Z][A-Z\s]{4,60}$"),  # ALL CAPS lines
        re.compile(r"^\d+[\.\)]\s+[A-Z].{4,80}$"),  # Numbered headings
        re.compile(
            r"^(Chapter|Section|Part|Module)\s+\d+[\.\-\:]\s+(.*)", re.IGNORECASE
        ),
    ]

    char_offset = 0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            char_offset += 1
            continue

        is_heading = False
        heading_text = ""
        for pattern in heading_patterns:
            m = pattern.match(stripped)
            if m:
                is_heading = True
                if m.lastindex and m.lastindex >= 2:
                    heading_text = m.group(2).strip()
                else:
                    heading_text = stripped.strip("#").strip()
                break

        if is_heading and len(heading_text) > 2:
            # Save previous chapter
            if current_chapter:
                current_chapter["end"] = char_offset
                chapters.append(current_chapter)

            current_chapter = {
                "title": heading_text,
                "start": char_offset,
                "end": char_offset,
                "subtopics": [],
            }

        char_offset += len(line) + 1

    if current_chapter:
        current_chapter["end"] = len(text)
        chapters.append(current_chapter)

    if not chapters:
        chapters = [
            {"title": "Full Document", "start": 0, "end": len(text), "subtopics": []}
        ]

    return {
        "map": {
            "chapters": chapters,
            "document_type": "unknown",
            "key_themes": [],
            "glossary_terms": [],
        },
        "doc_type": "unknown",
        "themes": [],
    }


async def save_raw_clean(state: IngestionState) -> dict:
    """Node 1: Clean text artifacts — fix hyphens, OCR errors, control characters. Runs FIRST so downstream nodes work with clean text."""
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
    Node 7: AI formats chapters into topper-quality notes, then splits
    each formatted chapter into subtopic-level chunks.
    Now processes chapters in PARALLEL.
    """
    import asyncio
    
    raw_chapters = state.get("raw_chapters", [])
    toc_with_subtopics = state.get("toc_with_subtopics", [])
    global_context = state.get("global_context", "")

    formatted: list[dict] = []
    all_subtopic_chunks: list[dict] = []

    system = (
        "You are an expert academic editor who transforms raw study material into "
        "TOPPER-QUALITY NOTES — the kind of beautifully structured, visually rich notes "
        "that top-ranking students use to ace competitive exams (UPSC, SSC, State PSC).\n\n"
        "═══════════════════════════════════════════════════════════════\n"
        "ABSOLUTE ANTI-HALLUCINATION CONTRACT (NON-NEGOTIABLE)\n"
        "═══════════════════════════════════════════════════════════════\n"
        "① SOURCE-ONLY: Every word, fact, name, date, number, formula, and concept in your "
        "output MUST come directly from the provided source text. You are a RESTRUCTURER, not a writer.\n"
        "② ZERO ADDITIONS: Do NOT add explanations, background context, examples, analogies, "
        "or any information not explicitly in the source text.\n"
        "③ ZERO OMISSIONS: Retain 100% of the information. Every sentence, every fact, every "
        "detail must appear in the output — just better organized.\n"
        "④ NO INVENTION: Do not infer, extrapolate, or fill in gaps. If it is not in the source, "
        "it does not exist in your output.\n"
        "⑤ CLEAN ARTIFACTS ONLY: Fix OCR errors, broken hyphenations, repeated headers, obvious "
        "typos. Nothing else.\n\n"
        "═══════════════════════════════════════════════════════════════\n"
        "STRUCTURAL & VISUAL DESIGN RULES\n"
        "═══════════════════════════════════════════════════════════════\n"
        "Use the following hierarchy — apply only what the source content supports:\n\n"
        "**1. CHAPTER HEADER**\n"
        "   # [Chapter Title]\n"
        "   > 📌 **Quick Context** — One sentence from the source summarizing this chapter.\n\n"
        "**2. SECTION HEADINGS (H2) — Use for subtopics**\n"
        "   ## [Subtopic Name]\n"
        "   Group related paragraphs under the subtopic headings provided in the structural guide.\n\n"
        "**3. SUBSECTIONS (H3)**\n"
        "   ### [Granular Topic]\n"
        "   Break each subtopic into finer points where the source supports it.\n\n"
        "**4. BULLET & NUMBERED LISTS**\n"
        "   - Use `- ` for unordered lists: features, causes, effects, characteristics\n"
        "   - Use `1. ` for ordered lists: timelines, steps, sequential events\n"
        "   - Use `  - ` (indent) for nested sub-points\n\n"
        "**5. MARKDOWN TABLES — for comparisons, classifications, or paired data**\n"
        "   | Column A | Column B | Column C |\n"
        "   |----------|----------|----------|\n"
        "   | value    | value    | value    |\n\n"
        "**6. BOLD TERMS & CALLOUT BOXES**\n"
        "   - **Bold** every key term, name, date, organization, and concept on first appearance\n"
        "   - Use blockquotes for critical exam-important facts:\n"
        "     > ⚡ **Key Fact:** [verbatim or closely restructured fact from source]\n\n"
        "**7. MEMORY AIDS** (only if source has 3+ enumerable items forming a list)\n"
        "   > 🧠 **Remember:** [items from source, clearly listed]\n\n"
        "**8. QUICK REVISION BOX** (mandatory at the end of every chapter)\n"
        "   ---\n"
        "   ### 📋 Quick Revision — Key Points\n"
        "   - [key point 1 — source only]\n"
        "   - [key point 2 — source only]\n"
        "   (Summarize only facts already stated above. Zero new information.)\n\n"
        "═══════════════════════════════════════════════════════════════\n"
        "OUTPUT FORMAT\n"
        "═══════════════════════════════════════════════════════════════\n"
        "Output ONLY the formatted Markdown. No code fences. No preamble. No commentary.\n"
        "Clean, consistent spacing. Exam-ready notes reviewable in 5 minutes."
    )

    async def process_chapter(chapter: dict) -> tuple[dict, list[dict]]:
        title = chapter["title"]
        subtopic_groups = chapter.get("subtopic_groups", [])

        if not subtopic_groups:
            return None, None

        toc_entry = None
        for t in toc_with_subtopics:
            if t["title"] == title:
                toc_entry = t
                break

        structural_guide = ""
        if toc_entry and toc_entry.get("subtopics"):
            sub_list = "\n".join(f"  - {s}" for s in toc_entry["subtopics"])
            structural_guide = (
                f"STRUCTURAL GUIDE for this chapter:\n"
                f"Chapter: {title}\n"
                f"Subtopics to use as ## headings:\n{sub_list}\n"
                "Format each subtopic's content under its corresponding ## heading.\n\n"
            )
        else:
            structural_guide = (
                f"CHAPTER: {title}\n"
                "Format the entire content under this single chapter.\n\n"
            )

        combined_raw = "\n\n".join(sg["raw_content"] for sg in subtopic_groups)

        prompt = (
            f"{structural_guide}"
            f"SOURCE TEXT (use ONLY this text — do not add anything not present below):\n"
            f"---\n{combined_raw}\n---\n\n"
            f"Transform the above source text into beautifully structured topper notes following "
            f"all the rules in your instructions."
        )

        ai_success = False
        chapter_formatted = None
        chapter_sub_chunks = []
        try:
            result = await generate_text(prompt, system_prompt=system, temperature=0.15)
            clean = result.strip()
            if len(clean) >= 10:
                chapter_formatted = {"title": title, "content": clean}
                ai_success = True

                chapter_sub_chunks = _split_at_subtopic_headers(clean, title)
                logger.info(
                    f"[Node 7] AI formatted '{title}' → {len(chapter_sub_chunks)} subtopic chunks"
                )
            else:
                raise ValueError(
                    f"AI returned abnormally short content ({len(clean)} chars)"
                )
        except Exception as e:
            logger.warning(
                f"[Node 7] AI format failed for '{title}': {e} — using rule-based fallback"
            )

        if not ai_success:
            fallback_content = "\n\n".join(sg["raw_content"] for sg in subtopic_groups)
            chapter_formatted = {"title": title, "content": fallback_content}
            chapter_sub_chunks = [
                {
                    "chapter_title": title,
                    "subtopic_title": title,
                    "content": fallback_content,
                }
            ]
        
        return chapter_formatted, chapter_sub_chunks

    # Run all chapters in parallel
    results = await asyncio.gather(*(process_chapter(c) for c in raw_chapters))
    
    for f_chap, s_chunks in results:
        if f_chap:
            formatted.append(f_chap)
        if s_chunks:
            all_subtopic_chunks.extend(s_chunks)

    logger.info(
        f"[Node 7] Formatted {len(formatted)} chapters, {len(all_subtopic_chunks)} total subtopic chunks"
    )
    return {"formatted_chapters": formatted, "subtopic_chunks": all_subtopic_chunks}


async def save_to_chroma(state: IngestionState) -> dict:
    """Node 8: Upsert subtopic-level chunks into ChromaDB."""
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
        count = await upsert_chunks(chunks, subject, topic, source)
        logger.info(f"[Node 8] Saved {count} subtopic chunks to ChromaDB")
        return {"chunks_saved": count}
    except Exception as e:
        logger.error(f"[Node 8] ChromaDB upsert failed: {e}")
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
        return {"wiki_result": result}
    except Exception as e:
        logger.warning(f"[Node 9] Wiki compilation failed (non-critical): {e}")
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
) -> dict:
    """Run the full 9-node ingestion pipeline and return a result summary."""
    initial: IngestionState = {
        "raw_text": raw_text.strip(),
        "subject": subject.strip(),
        "topic": topic.strip(),
        "source_name": source_name.strip(),
        "errors": [],
    }

    final = await ingestion_graph.ainvoke(initial)

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
