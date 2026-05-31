# ─────────────────────────────────────────────────────────────────────────────
# backend/graphs/ingestion_graph.py
# LangGraph-native ingestion state machine.
#
# 7-Node Pipeline:
#  1. split_paragraphs  → split rawText at paragraph boundaries (pure Python)
#  2. plan_toc          → AI plans chapter titles from stratified sample
#  3. tag_paragraphs    → keyword-overlap scoring assigns paragraphs to chapters
#  4. assemble_chapters → groups paragraphs; COMPLETENESS GATE (≥92%)
#  5. format_chapters   → AI cleans + structures content (anti-hallucination rules)
#  6. save_to_chroma    → upsert chunks into ChromaDB
#  7. extract_mindmap   → AI extracts concept graph (failure-safe bonus)
# ─────────────────────────────────────────────────────────────────────────────
import json
import logging
import operator
import re
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

    # Node 1 output
    paragraphs: list[str]

    # Node 2 output
    chapter_titles: list[str]
    global_context: str

    # Node 3 output
    tagged_paragraphs: list[dict]  # [{chapter_idx: int, text: str}]

    # Node 4 output
    raw_chapters: list[dict]       # [{title: str, raw_content: str}]
    completeness_score: float

    # Node 5 output
    formatted_chapters: list[dict]  # [{title: str, content: str}]

    # Node 6 output: chunks saved count
    chunks_saved: int

    # Node 7 output
    mindmap: dict | None           # {nodes: [...], edges: [...]}

    # Error log — Annotated with operator.add so errors ACCUMULATE across nodes
    # (without this, each node's return would REPLACE the previous errors list)
    errors: Annotated[list[str], operator.add]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_parse_json(text: str) -> Any:
    """Strip markdown fences and parse JSON."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).rstrip("```").strip()
    return json.loads(cleaned)


def _score_text_for_title(text: str, title: str) -> float:
    """Keyword-overlap score (pure Python, zero LLM)."""
    stop = {"the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for",
            "with", "by", "from", "is", "was", "are", "were", "be"}
    title_tokens = {w.lower() for w in re.findall(r"\b\w+\b", title)
                    if w.lower() not in stop and len(w) > 2}
    if not title_tokens:
        return 0.0
    text_lower = text.lower()
    hits = sum(1 for t in title_tokens if t in text_lower)
    return hits / len(title_tokens)


def _apply_rule_based_markdown(raw: str) -> str:
    """Deterministic formatting: ALL CAPS → bold, key-value lines → list items."""
    lines = raw.split("\n")
    output = []
    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            output.append("")
            continue

        is_all_caps = (trimmed == trimmed.upper() and
                       bool(re.search(r"[A-Z]", trimmed)) and
                       len(trimmed.replace(" ", "")) >= 4)
        if is_all_caps:
            output.append(f"\n**{trimmed}**")
            continue

        is_list = bool(re.match(r"^[-*•]\s", trimmed)) or bool(re.match(r"^\d+[.)]\s", trimmed))
        if is_list:
            output.append(line)
            continue

        output.append(line)

    return "\n".join(output).strip()


# ─────────────────────────────────────────────────────────────────────────────
# Graph Nodes
# ─────────────────────────────────────────────────────────────────────────────

async def split_paragraphs(state: IngestionState) -> dict:
    """Node 1: Split rawText into paragraphs at blank-line boundaries."""
    raw = state.get("raw_text", "")
    paras = [p.strip() for p in re.split(r"\n{2,}", raw) if p.strip()]
    logger.info(f"[Node 1] {len(paras)} paragraphs from {len(raw)} chars")
    return {"paragraphs": paras}


async def plan_toc(state: IngestionState) -> dict:
    """Node 2: AI plans chapter titles from a stratified document sample."""
    raw = state.get("raw_text", "")
    n = len(raw)
    sample = "\n\n".join([
        "=== BEGINNING ===", raw[:4000],
        "=== MIDDLE ===", raw[max(0, n//2 - 2000): n//2 + 2000],
        "=== END ===", raw[max(0, n - 4000):],
    ])

    system = (
        "You are a curriculum analyst. Analyze this document sample and produce a "
        "Table of Contents with 2–8 distinct chapter titles.\n"
        "RULES: Titles must be clean academic names. No filenames or extensions.\n"
        'Output ONLY this JSON (no fences): {"chapterTitles": [...], "globalContext": "..."}'
    )
    prompt = f'DOCUMENT SAMPLE:\n---\n{sample}\n---\nSource (do NOT use in titles): "{state.get("source_name", "")}"'

    try:
        resp = await generate_text(prompt, system_prompt=system, json_mode=True)
        payload = _safe_parse_json(resp)
        titles = [t.strip() for t in payload.get("chapterTitles", []) if t.strip()]
        if not titles:
            titles = ["Complete Study Notes"]
        context = payload.get("globalContext", "Academic study material.")
        logger.info(f"[Node 2] TOC: {titles}")
        return {"chapter_titles": titles, "global_context": context}
    except Exception as e:
        logger.warning(f"[Node 2] TOC planning failed: {e}")
        return {
            "chapter_titles": ["Complete Study Notes"],
            "global_context": "Academic study material.",
            "errors": [f"plan_toc: {e}"],
        }


async def tag_paragraphs(state: IngestionState) -> dict:
    """Node 3: Assign each paragraph to its best-matching chapter (pure Python)."""
    paras = state.get("paragraphs", [])
    titles = state.get("chapter_titles", ["Complete Study Notes"])

    if len(titles) == 1:
        tagged = [{"chapter_idx": 0, "text": p} for p in paras]
        return {"tagged_paragraphs": tagged}

    tagged = []
    for i, para in enumerate(paras):
        scores = [_score_text_for_title(para, t) for t in titles]
        max_score = max(scores)
        if max_score == 0:
            # Proportional positional fallback
            idx = min(int(i / len(paras) * len(titles)), len(titles) - 1)
        else:
            idx = scores.index(max_score)
        tagged.append({"chapter_idx": idx, "text": para})

    logger.info(f"[Node 3] Tagged {len(tagged)} paragraphs")
    return {"tagged_paragraphs": tagged}


async def assemble_chapters(state: IngestionState) -> dict:
    """Node 4: Group paragraphs by chapter + COMPLETENESS GATE."""
    tagged = state.get("tagged_paragraphs", [])
    titles = state.get("chapter_titles", ["Complete Study Notes"])
    raw_text = state.get("raw_text", "")

    groups: dict[int, list[str]] = {i: [] for i in range(len(titles))}
    for item in tagged:
        groups[item["chapter_idx"]].append(item["text"])

    chapters = [
        {"title": titles[i], "raw_content": "\n\n".join(groups[i])}
        for i in range(len(titles))
        if groups[i]
    ]

    # Completeness gate: ≥92% of paragraph chars must be preserved
    total_para_chars = sum(len(item["text"]) for item in tagged)
    preserved_chars = sum(len(c["raw_content"]) for c in chapters)
    score = preserved_chars / total_para_chars if total_para_chars > 0 else 1.0

    logger.info(f"[Node 4] Completeness: {score:.1%} ({preserved_chars}/{total_para_chars})")

    if score < 0.92:
        logger.warning(f"[Node 4] GATE TRIGGERED — falling back to single chapter")
        chapters = [{"title": titles[0], "raw_content": raw_text}]
        score = 1.0

    return {"raw_chapters": chapters, "completeness_score": score}


async def format_chapters(state: IngestionState) -> dict:
    """Node 5: AI-assisted formatting — produces topper-quality structured notes."""
    formatted: list[dict] = []

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

        "**2. SECTION HEADINGS (H2)**\n"
        "   ## [Major Theme or Topic]\n"
        "   Group related paragraphs under logical headings DERIVED FROM the source content.\n\n"

        "**3. SUBSECTIONS (H3)**\n"
        "   ### [Subtopic Name]\n"
        "   Break each section into granular subtopics where the source supports it.\n\n"

        "**4. BULLET & NUMBERED LISTS**\n"
        "   - Use `- ` for unordered lists: features, causes, effects, characteristics\n"
        "   - Use `1. ` for ordered lists: timelines, steps, sequential events\n"
        "   - Use `  - ` (indent) for nested sub-points\n\n"

        "**5. MARKDOWN TABLES — for comparisons, classifications, or paired data**\n"
        "   When source has comparisons, multiple items with common attributes, dates+events, "
        "or categories, render as a Markdown table:\n"
        "   | Column A | Column B | Column C |\n"
        "   |----------|----------|----------|\n"
        "   | value    | value    | value    |\n\n"

        "**6. BOLD TERMS & CALLOUT BOXES**\n"
        "   - **Bold** every key term, name, date, organization, and concept on first appearance\n"
        "   - Use blockquotes for critical exam-important facts sourced from the text:\n"
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

    for chapter in state.get("raw_chapters", []):
        raw = chapter["raw_content"]
        title = chapter["title"]
        prompt = (
            f'CHAPTER TITLE: "{title}"\n\n'
            f'SOURCE TEXT (use ONLY this text — do not add anything not present below):\n'
            f'---\n{raw}\n---\n\n'
            f'Transform the above source text into beautifully structured topper notes following '
            f'all the rules in your instructions.\n'
            f'CRITICAL REMINDER: RESTRUCTURE ONLY. Every word in your output must exist in the '
            f'source text above. Do not add, invent, or infer anything not already written there.'
        )

        ai_success = False
        try:
            result = await generate_text(prompt, system_prompt=system, temperature=0.15)
            clean = result.strip()
            if len(clean) >= 10:
                formatted.append({"title": title, "content": clean})
                ai_success = True
            else:
                raise ValueError(f"AI returned abnormally short content ({len(clean)} chars)")
        except Exception as e:
            logger.warning(f"[Node 5] AI format failed for '{title}': {e} — using rule-based fallback")

        # Always fall back to rule-based markdown if AI failed — NEVER drop a chapter
        if not ai_success:
            fallback = _apply_rule_based_markdown(raw)
            formatted.append({"title": title, "content": fallback if fallback.strip() else raw})

    logger.info(f"[Node 5] Formatted {len(formatted)} chapters")
    return {"formatted_chapters": formatted}



async def save_to_chroma(state: IngestionState) -> dict:
    """Node 6: Upsert formatted chapters into ChromaDB."""
    chapters = state.get("formatted_chapters", [])
    subject = state.get("subject", "General")
    topic = state.get("topic", "Imported Material")
    source = state.get("source_name", "unknown")

    # Build chunks list for the vector store
    chunks = [{"title": c["title"], "content": c["content"]} for c in chapters]

    try:
        count = await upsert_chunks(chunks, subject, topic, source)
        logger.info(f"[Node 6] Saved {count} chunks to ChromaDB")
        return {"chunks_saved": count}
    except Exception as e:
        logger.error(f"[Node 6] ChromaDB upsert failed: {e}")
        return {"chunks_saved": 0, "errors": [f"save_to_chroma: {e}"]}


async def extract_mindmap(state: IngestionState) -> dict:
    """Node 7: AI extracts concept graph (failure-safe — notes already saved)."""
    chapters = state.get("formatted_chapters", [])
    compact = "\n\n".join(f"# {c['title']}\n{c['content'][:500]}" for c in chapters)

    system = (
        'Extract key academic concepts and relationships.\n'
        'Output ONLY this JSON (no fences): '
        '{"nodes": [{"id": "snake_case_id", "label": "Concept Name"}], '
        '"edges": [{"source": "id", "target": "id", "label": "verb"}]}'
    )
    prompt = f"STUDY NOTES:\n---\n{compact}\n---\nExtract the knowledge graph."

    try:
        resp = await generate_text(prompt, system_prompt=system, json_mode=True)
        graph = _safe_parse_json(resp)
        if graph.get("nodes"):
            logger.info(f"[Node 7] Mindmap: {len(graph['nodes'])} nodes, {len(graph.get('edges', []))} edges")
            return {"mindmap": graph}
    except Exception as e:
        logger.warning(f"[Node 7] Mindmap extraction failed (non-critical): {e}")
        return {"errors": [f"extract_mindmap: {e}"]}

    return {"mindmap": None}


# ─────────────────────────────────────────────────────────────────────────────
# Graph Builder
# ─────────────────────────────────────────────────────────────────────────────

def build_ingestion_graph():
    g = StateGraph(IngestionState)

    g.add_node("split_paragraphs", split_paragraphs)
    g.add_node("plan_toc", plan_toc)
    g.add_node("tag_paragraphs", tag_paragraphs)
    g.add_node("assemble_chapters", assemble_chapters)
    g.add_node("format_chapters", format_chapters)
    g.add_node("save_to_chroma", save_to_chroma)
    g.add_node("extract_mindmap", extract_mindmap)

    g.set_entry_point("split_paragraphs")
    g.add_edge("split_paragraphs", "plan_toc")
    g.add_edge("plan_toc", "tag_paragraphs")
    g.add_edge("tag_paragraphs", "assemble_chapters")
    g.add_edge("assemble_chapters", "format_chapters")
    g.add_edge("format_chapters", "save_to_chroma")
    g.add_edge("save_to_chroma", "extract_mindmap")
    g.add_edge("extract_mindmap", END)

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
    """Run the full ingestion pipeline and return a result summary."""
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
        "chunks_saved": final.get("chunks_saved", 0),
        "completeness_score": final.get("completeness_score", 0.0),
        "mindmap": final.get("mindmap"),
        "errors": final.get("errors", []),
    }
