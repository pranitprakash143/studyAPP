# PrepAgent — Improvements Tracker
> Living document · Updated as each feature is implemented and verified  
> Source: Research synthesis from KMS/LLM literature, Karpathy's LLM Wiki (Apr 2026), and PrepAgent codebase analysis

---

## Legend
- `[ ]` — Not started
- `[/]` — In progress
- `[x]` — Implemented & verified
- `[!]` — Blocked / needs review

---

## Batch 1 — Active Sprint

### [x] LLM Wiki Compiled Pages
> **Karpathy insight**: treat knowledge as a *compiled codebase*, not a search index. `master_kb.md` is the right idea — evolve it into structured, agent-compiled, cross-linked entity pages that compound with every new ingestion.

**What changed:**
- Added **Node 10: `compile_wiki_pages`** to the LangGraph ingestion pipeline (after `extract_mindmap`)
- New backend module: `backend/wiki/wiki_compiler.py` — agent-powered wiki page compiler
- New API endpoint: `GET /api/wiki` — lists all wiki pages with metadata
- New API endpoint: `GET /api/wiki/{subject}/{slug}` — serves individual wiki page content
- New Next.js API route: `src/app/api/wiki/route.ts` — proxies wiki requests
- New frontend page: `src/app/wiki/page.tsx` — visual wiki explorer with interactive graph
- Wiki lives at: `knowledge_base/wiki/{subject}/{slug}.md` — structured, hyperlinked Markdown files
- `knowledge_base/wiki/index.json` — master index for fast lookup and graph visualization
- Wiki page format: frontmatter (title, subject, tags, related, last_compiled) + sections (Summary, Key Facts, Connections, Memory Hooks)

**Files modified:**
- `backend/graphs/ingestion_graph.py` — added Node 10 + edge
- `backend/api/ingest.py` — returns wiki_pages_updated count
- `backend/main.py` — registers wiki router

**Files created:**
- `backend/wiki/__init__.py`
- `backend/wiki/wiki_compiler.py`
- `backend/api/wiki.py`
- `src/app/api/wiki/route.ts` (Root proxy)
- `src/app/api/wiki/graph/route.ts` (Graph proxy - *Fixed Next.js dynamic routing issue*)
- `src/app/api/wiki/[subject]/[slug]/route.ts` (Slug proxy - *Fixed Next.js dynamic routing issue*)
- `src/app/wiki/page.tsx`
- `knowledge_base/wiki/` directory structure

---

### [x] HyDE Retrieval (Hypothetical Document Embeddings)
> **Research insight**: embed a *hypothetical ideal answer* instead of the raw query. Bridges the query-document linguistic gap. ~20 lines of code, 15–30% better recall.

**What changed:**
- Added `query_chunks_with_hyde()` to `backend/vectorstore/chroma_store.py`
- New backend endpoint: `POST /api/query` now accepts optional `use_hyde: bool` parameter
- All retrieval-heavy API routes now use HyDE by default (notes, quiz, socratic)
- HyDE generates a ~150-token "hypothetical exam answer" before embedding
- Falls back to standard retrieval on HyDE generation failure (failure-safe)

**Files modified:**
- `backend/vectorstore/chroma_store.py` — added `query_chunks_with_hyde()`
- `backend/api/query.py` — exposed `use_hyde` parameter
- `src/app/api/notes/route.ts` — passes `use_hyde: true`
- `src/app/api/quiz/route.ts` — passes `use_hyde: true`
- `src/app/api/socratic/route.ts` — passes `use_hyde: true`

---

## Batch 2 — Planned Next

### [ ] Streaming SSE Responses
> Replace blocking AI calls with Server-Sent Events. First token appears in ~500ms.

**Planned changes:**
- `src/app/api/notes/route.ts` — return `ReadableStream` with SSE
- `src/app/api/socratic/route.ts` — stream Socratic rounds
- Frontend components — update to handle `EventSource` streams

---

### [ ] Session Persistence & Learning History
> Save Socratic sessions, quiz results, and mastery scores across sessions.

**Planned changes:**
- New: `knowledge_base/metadata/sessions.json`
- New: `src/app/api/sessions/route.ts`
- New: `src/app/history/page.tsx`

---

### [ ] PYQ Semantic Indexing
> Ingest PYQ banks into ChromaDB `prepagent_pyqs` collection for semantic search.

**Planned changes:**
- New ChromaDB collection `prepagent_pyqs`
- Modified: `backend/api/ingest.py` — PYQ ingest path
- New: `src/app/api/pyq/search/route.ts`

---

### [ ] Spaced Repetition System (SRS)
> SM-2 algorithm integration. Wrong quiz answers auto-create review cards.

**Planned changes:**
- New: `knowledge_base/metadata/srs_cards.json`
- New: `src/app/api/srs/route.ts`
- New: `src/app/review/page.tsx`
- Modified: `src/app/quiz/page.tsx` — "Save as SRS card" button

---

### [ ] Knowledge Tracing & Analytics Dashboard
> BKT mastery tracking per topic. Heatmap + trend charts on dashboard.

**Planned changes:**
- New: `knowledge_base/metadata/knowledge_tracking.json`
- New: `src/app/api/mastery/route.ts`
- Modified: `src/app/page.tsx` — add mastery heatmap section

---

### [ ] Hybrid Search (BM25 + Vector)
> Add BM25 sparse retrieval fused with dense vector search via RRF.

**Planned changes:**
- New dependency: `rank-bm25` in `backend/requirements.txt`
- Modified: `backend/vectorstore/chroma_store.py` — `hybrid_search()`
- Modified: `backend/api/query.py` — default to hybrid

---

### [ ] Dynamic Subject Taxonomy
> Remove hardcoded `HARDCODED_SUBJECTS` array. Allow custom subject creation.

**Planned changes:**
- Modified: `src/lib/settings.ts`
- Modified: `src/app/settings/page.tsx` — "Add Subject" UI

---

### [ ] Flashcard System
> Auto-generate front/back cards from subtopic chunks. Ties into SRS.

**Planned changes:**
- New: `knowledge_base/metadata/flashcards.json`
- New: `src/app/api/flashcards/route.ts`
- New: `src/app/flashcards/page.tsx`

---

### [ ] Prerequisite Knowledge Graph
> Cross-topic concept graph with prerequisite edges. Learning path enabler.

**Planned changes:**
- Extended: `knowledge_base/metadata/mindmaps.json` → `concept_graph.json`
- Modified: ingestion pipeline Node 9 (extract_mindmap) — cross-topic edges
- Modified: `src/app/wiki/page.tsx` — show prerequisite graph

---

## Research References

| Research Topic | Source | Key Insight Applied |
|-------|--------|---------------------|
| LLM Wiki pattern | [Karpathy Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) | Knowledge as compiled codebase; agent-maintained synthesis |
| HyDE | Zhang et al. 2022; 2024 RAG survey | Hypothetical answer embedding outperforms direct query embedding |
| KMS for LLMs | Applied-AI, LlamaIndex docs 2024–2025 | Memory taxonomy: weights / context / external |
| Spaced Repetition + LLMs | LECTOR Framework 2024 | Semantic-aware SRS scheduling |
| Knowledge Tracing | BKT, DKT, DialogueKT 2024 | Probabilistic mastery tracking per skill |
| GraphRAG | Microsoft 2024 | Community-aware knowledge graphs for multi-hop reasoning |
| Graph Visualizations | May 2026 Web Research | React Flow (`@xyflow/react`) is recommended for modern, interactive, DOM-based node explorers (Wiki/Mindmap) in Next.js apps |
| Ingestion Performance | May 2026 Web Research | ARQ/BackgroundTasks for decoupling ingestion; LangGraph Map-Reduce for parallel chapter processing; `asyncio` for I/O bounds |

---

### [x] Graph Visualization & Async Migration
> **Completed 2026-05**: Migrated to React Flow and parallelized the backend ingestion.

**What changed:**
- Replaced `react-force-graph-2d` with `@xyflow/react` in `src/app/subject/page.tsx` and `src/app/wiki/page.tsx`.
- Implemented `ReactFlowGraph` wrapper leveraging `dagre` for auto-layouting.
- Decoupled `/api/ingest` pipeline from HTTP response cycle using `BackgroundTasks`.
- Parallelized document chunks execution using `asyncio.gather`.