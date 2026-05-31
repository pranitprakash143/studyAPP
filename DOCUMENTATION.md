# PrepAgent — Developer Documentation

> **PrepAgent** is an AI-powered study assistant built with **Next.js 16** (frontend) and **Python FastAPI** (backend). It ingests study materials (PDFs, DOCX, images, YouTube videos, pasted text), structures them via a LangGraph pipeline, stores them in ChromaDB (vector database), and provides RAG-powered study tools including note generation, MCQ quizzes, Socratic seminars, and PYQ gap analysis.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Frontend: Next.js App](#frontend-nextjs-app)
  - [Pages & Routes](#pages--routes)
  - [Components](#components)
  - [Library Modules](#library-modules)
  - [API Routes](#api-routes)
- [Backend: FastAPI](#backend-fastapi)
  - [Entry Point](#entry-point)
  - [API Endpoints](#api-endpoints)
  - [Parsers](#parsers)
  - [Ingestion Graph (LangGraph)](#ingestion-graph-langgraph)
  - [Vector Store (ChromaDB)](#vector-store-chromadb)
  - [LLM Factory](#llm-factory)
  - [Configuration](#configuration)
- [Data Flow: Ingestion Pipeline](#data-flow-ingestion-pipeline)
- [Data Flow: RAG Retrieval](#data-flow-rag-retrieval)
- [Storage Layer](#storage-layer)
- [Docker & Deployment](#docker--deployment)
- [AI Provider Configuration](#ai-provider-configuration)
- [Key Design Patterns](#key-design-patterns)
- [Future Enhancements Research (May 2026)](#future-enhancements-research-may-2026)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Next.js)                      │
│  ┌──────────┐  ┌──────────┐  ┌───────┐  ┌───────┐          │
│  │  Pages   │  │Components│  │  Lib  │  │  API  │          │
│  └────┬─────┘  └──────────┘  └───┬───┘  └───┬───┘          │
│       │                          │          │               │
│       └──────────────────────────┼──────────┘               │
│                                  │                          │
│          Next.js API Routes (server-side)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch()
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Python FastAPI Backend                      │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Parsers │→ │ LangGraph│→ │ ChromaDB │  │   LLM    │     │
│  └─────────┘  └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Three service containers** ([`docker-compose.yml`](docker-compose.yml)):

| Service | Port | Purpose |
|---------|------|---------|
| `chromadb` | 8001 | Vector database (persistent embeddings) |
| `backend` | 8000 | Python FastAPI (parsing, LangGraph, ChromaDB client) |
| `nextjs` | 3000 | Next.js frontend + API route proxies |

---

## Directory Structure

```
StudyApp/
├── backend/                      # Python FastAPI backend
│   ├── main.py                   # Entry point, lifespan, CORS, routers
│   ├── api/                      # FastAPI route handlers
│   │   ├── health.py             # GET /health
│   │   ├── ingest.py             # POST /api/ingest
│   │   ├── query.py              # POST /api/query
│   │   └── subjects.py           # GET/POST/DELETE /api/subject/*
│   ├── core/                     # Core utilities
│   │   ├── config.py             # Pydantic Settings from .env
│   │   └── llm.py                # LLM + Embedding factory (LangChain)
│   ├── parsers/                  # File type parsers
│   │   ├── router.py             # MIME-type dispatcher
│   │   ├── pdf_parser.py         # pypdf + pdfminer.six
│   │   ├── docx_parser.py        # python-docx + python-pptx
│   │   ├── image_parser.py       # Gemini Vision / Tesseract OCR
│   │   └── youtube_parser.py     # youtube-transcript-api
│   ├── graphs/                   # LangGraph workflows
│   │   └── ingestion_graph.py    # 7-node ingestion state machine
│   ├── vectorstore/              # ChromaDB client
│   │   └── chroma_store.py       # Embedding + CRUD operations
│   ├── Dockerfile
│   └── requirements.txt
│
├── src/                          # Next.js frontend
│   ├── app/                      # App Router pages
│   │   ├── page.tsx              # Dashboard (home)
│   │   ├── layout.tsx            # Root layout, theme injection
│   │   ├── upload/page.tsx       # Upload & ingest materials
│   │   ├── notes/page.tsx        # RAG notes workspace
│   │   ├── quiz/page.tsx         # MCQ quiz engine
│   │   ├── socratic/page.tsx     # Socratic seminar coach
│   │   ├── pyq/page.tsx          # PYQ analysis & gap scan
│   │   ├── library/page.tsx      # Master library index
│   │   ├── subject/page.tsx      # Subject binder (editor + mindmap)
│   │   ├── settings/page.tsx     # AI configuration
│   │   └── api/                  # Next.js API routes (proxies)
│   │       ├── ingest/route.ts   # → FastAPI /api/ingest
│   │       ├── notes/route.ts    # RAG note generation
│   │       ├── quiz/route.ts     # MCQ generation
│   │       ├── socratic/route.ts # Socratic session
│   │       ├── subject/route.ts  # Subject CRUD
│   │       ├── library/route.ts  # Catalog + search
│   │       ├── highlights/route.ts # Highlight CRUD
│   │       ├── mindmaps/route.ts # Mindmap graph data
│   │       ├── pyq/route.ts      # PYQ extraction
│   │       ├── pyq/analyze/route.ts # Gap analysis
│   │       ├── notes/restructure/route.ts # AI text restructuring
│   │       ├── notes/explain/route.ts     # Socratic explanation
│   │       └── settings/test/route.ts     # Connection test
│   ├── components/               # Shared UI components
│   │   ├── Navbar.tsx            # Top bar with breadcrumbs + search
│   │   ├── Sidebar.tsx           # Navigation + theme picker
│   │   └── CustomDropdown.tsx    # Reusable dropdown component
│   └── lib/                      # Client-side utilities
│       ├── settings.ts           # localStorage settings + AI headers
│       ├── ai-provider.ts        # Gemini / LM Studio text generation
│       ├── vector-store.ts       # Local vector DB (fallback)
│       ├── ingestion-graph.ts    # Local ingestion state machine
│       ├── highlights-store.ts   # Highlight persistence (JSON file)
│       ├── mindmap-store.ts      # Mindmap graph persistence (JSON)
│       └── backend-client.ts     # Typed HTTP client for FastAPI
│
├── knowledge_base/               # Persistent storage (shared volume)
│   ├── master_kb.md              # Compiled master markdown
│   ├── metadata/
│   │   ├── vector_db.json        # Local chunk DB (fallback)
│   │   ├── highlights.json       # User highlights
│   │   └── mindmaps.json         # Concept graphs
│   └── pyqs/                     # PYQ markdown banks
│
├── docker-compose.yml            # 3-service orchestration
├── Dockerfile.nextjs             # Next.js production build
├── package.json                  # Node dependencies
├── start.sh                      # Dev start/stop/reset script
└── README.md
```

---

## Frontend: Next.js App

### Pages & Routes

| Page | Path | File | Description |
|------|------|------|-------------|
| **Dashboard** | `/` | [`src/app/page.tsx`](src/app/page.tsx) | Home page with stats, subject list, quick actions |
| **Upload** | `/upload` | [`src/app/upload/page.tsx`](src/app/upload/page.tsx) | Ingest files/YouTube/text with animated pipeline tracker |
| **Study Notes** | `/notes` | [`src/app/notes/page.tsx`](src/app/notes/page.tsx) | RAG-powered note generation from knowledge base |
| **Quiz** | `/quiz` | [`src/app/quiz/page.tsx`](src/app/quiz/page.tsx) | MCQ quiz engine with scoring and explanations |
| **Socratic** | `/socratic` | [`src/app/socratic/page.tsx`](src/app/socratic/page.tsx) | 5-round oral exam with mastery report |
| **PYQ Analysis** | `/pyq` | [`src/app/pyq/page.tsx`](src/app/pyq/page.tsx) | Two-stage: extract Q&As → syllabus gap analysis |
| **Library** | `/library` | [`src/app/library/page.tsx`](src/app/library/page.tsx) | Catalog browser + semantic search across notes + PYQs |
| **Subject Binder** | `/subject?subject=Name` | [`src/app/subject/page.tsx`](src/app/subject/page.tsx) | Full editor: preview/edit/split/visual/mindmap tabs, TTS, export |
| **Settings** | `/settings` | [`src/app/settings/page.tsx`](src/app/settings/page.tsx) | AI provider config, theme selection, connection test |

**Root Layout**: [`src/app/layout.tsx`](src/app/layout.tsx) — loads Geist fonts, injects theme classes from localStorage before hydration.

### Components

| Component | File | Purpose |
|-----------|------|---------|
| **Navbar** | [`src/components/Navbar.tsx`](src/components/Navbar.tsx) | Breadcrumbs, global search bar, live ingestion stats badge, user profile |
| **Sidebar** | [`src/components/Sidebar.tsx`](src/components/Sidebar.tsx) | Navigation links (8 pages), collapsible, theme picker dropdown |
| **CustomDropdown** | [`src/components/CustomDropdown.tsx`](src/components/CustomDropdown.tsx) | Reaccessible dropdown with keyboard nav, icons, descriptions |

### Library Modules

| Module | File | Purpose |
|--------|------|---------|
| **Settings** | [`src/lib/settings.ts`](src/lib/settings.ts) | `UserSettings` interface, `loadSettings`/`saveSettings` (localStorage), `getAIHeaders()` (sets `x-ai-provider`, `x-gemini-api-key`, etc.), `HARDCODED_SUBJECTS` array |
| **AI Provider** | [`src/lib/ai-provider.ts`](src/lib/ai-provider.ts) | `AIProviderConfig` interface, `getAIConfigFromRequest()` (reads headers from NextRequest), `generateText()` (Gemini REST or LM Studio OpenAI-compatible), `embedText()` (Gemini embeddings) |
| **Backend Client** | [`src/lib/backend-client.ts`](src/lib/backend-client.ts) | Typed HTTP client → FastAPI at `:8000`. Auto-corrects Docker hostnames. Functions: `proxyIngest`, `queryKnowledgeBase`, `listSubjects`, `getSubjectChunks`, `deleteSubject`, `saveSubjectNotesDirectly` |
| **Vector Store (local)** | [`src/lib/vector-store.ts`](src/lib/vector-store.ts) | Local JSON-based fallback: `loadVectorDb`, `saveVectorDb`, `rebuildMasterKb`, `ingestDocument`, `searchKnowledgeBase` (cosine similarity or token overlap) |
| **Ingestion Graph (local)** | [`src/lib/ingestion-graph.ts`](src/lib/ingestion-graph.ts) | TypeScript state machine (`StatefulIngestionGraph`): 8 nodes — understand → partition → extract → chapterize → save draft → verify → mindmap → save final |
| **Highlights Store** | [`src/lib/highlights-store.ts`](src/lib/highlights-store.ts) | JSON file CRUD for user highlights with color + annotation |
| **Mindmap Store** | [`src/lib/mindmap-store.ts`](src/lib/mindmap-store.ts) | JSON file persistence for concept graphs (nodes + edges) per subject/topic |

### API Routes

All Next.js API routes live under `src/app/api/*/route.ts`. They act as **server-side proxies** and **AI orchestration layers**.

| Route | File | Method | Purpose |
|-------|------|--------|---------|
| `/api/ingest` | [`src/app/api/ingest/route.ts`](src/app/api/ingest/route.ts) | POST | Proxies FormData → FastAPI `/api/ingest`. Maps field names (`youtubeUrl` → `youtube_url`) |
| `/api/notes` | [`src/app/api/notes/route.ts`](src/app/api/notes/route.ts) | GET / POST | GET: returns KB stats. POST: semantic retrieval + AI note generation with anti-hallucination prompt |
| `/api/quiz` | [`src/app/api/quiz/route.ts`](src/app/api/quiz/route.ts) | POST | Semantic search → MCQ generation (JSON output, strictly from context) |
| `/api/socratic` | [`src/app/api/socratic/route.ts`](src/app/api/socratic/route.ts) | POST | Multi-round Socratic session (round 0-5): question → grade → feedback → mastery report |
| `/api/subject` | [`src/app/api/subject/route.ts`](src/app/api/subject/route.ts) | GET / POST / DELETE | GET: fetch + compile markdown. POST: save edited notes directly to ChromaDB. DELETE: remove subject/topic |
| `/api/library` | [`src/app/api/library/route.ts`](src/app/api/library/route.ts) | GET / POST | GET: list subjects + PYQ banks. POST: semantic search across ChromaDB + keyword search in PYQ files |
| `/api/highlights` | [`src/app/api/highlights/route.ts`](src/app/api/highlights/route.ts) | GET / POST / DELETE | CRUD for text highlights (stored in `knowledge_base/metadata/highlights.json`) |
| `/api/mindmaps` | [`src/app/api/mindmaps/route.ts`](src/app/api/mindmaps/route.ts) | GET | Load concept graphs by subject/topic |
| `/api/pyq` | [`src/app/api/pyq/route.ts`](src/app/api/pyq/route.ts) | POST / DELETE | POST: OCR (Gemini Vision or Tesseract) → AI Q&A extraction → save to `knowledge_base/pyqs/`. DELETE: remove PYQ file |
| `/api/pyq/analyze` | [`src/app/api/pyq/analyze/route.ts`](src/app/api/pyq/analyze/route.ts) | POST | Gap analysis: cross-reference PYQ topics against existing study chunks |
| `/api/notes/restructure` | [`src/app/api/notes/restructure/route.ts`](src/app/api/notes/restructure/route.ts) | POST | AI restructures selected text segment (bullets, tables, timelines) |
| `/api/notes/explain` | [`src/app/api/notes/explain/route.ts`](src/app/api/notes/explain/route.ts) | POST | Socratic explanation: core concept → key details → check-in question |
| `/api/settings/test` | [`src/app/api/settings/test/route.ts`](src/app/api/settings/test/route.ts) | POST | Connection test: sends "Say CONNECTED" to configured AI provider |

---

## Backend: FastAPI

### Entry Point

[`backend/main.py`](backend/main.py) — FastAPI application:
- **Lifespan**: retries ChromaDB connection 15 times on startup
- **CORS**: configured from [`core/config.py`](backend/core/config.py) `cors_origins`
- **Routers**: mounts `health`, `ingest`, `query`, `subjects`

### API Endpoints

| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/health` | [`backend/api/health.py`](backend/api/health.py) | GET | Health check: FastAPI status + ChromaDB heartbeat |
| `/api/ingest` | [`backend/api/ingest.py`](backend/api/ingest.py) | POST | Accepts file/pasted_text/youtube_url → routes to parser → runs LangGraph pipeline → upserts to ChromaDB |
| `/api/query` | [`backend/api/query.py`](backend/api/query.py) | POST | Semantic search over ChromaDB with optional subject filter |
| `/api/subjects` | [`backend/api/subjects.py`](backend/api/subjects.py) | GET / POST / DELETE | List subjects, get subject chunks, save notes directly, delete subject/topic |

### Parsers

[`backend/parsers/router.py`](backend/parsers/router.py) — MIME-type dispatcher:

| Parser | File | Handles |
|--------|------|---------|
| **PDF** | [`backend/parsers/pdf_parser.py`](backend/parsers/pdf_parser.py) | pypdf (primary) → pdfminer.six (fallback) → text cleanup |
| **DOCX/PPTX** | [`backend/parsers/docx_parser.py`](backend/parsers/docx_parser.py) | python-docx (paragraphs + tables), python-pptx (slides) |
| **Image** | [`backend/parsers/image_parser.py`](backend/parsers/image_parser.py) | Gemini Vision API (cloud) or Tesseract (local) |
| **YouTube** | [`backend/parsers/youtube_parser.py`](backend/parsers/youtube_parser.py) | youtube-transcript-api (English preferred) |
| **Text** | [`backend/parsers/router.py`](backend/parsers/router.py) | Direct UTF-8 decode for `.txt`, `.md` |

### Ingestion Graph (LangGraph) — v2 (9-Node Pipeline)

[`backend/graphs/ingestion_graph.py`](backend/graphs/ingestion_graph.py) — **9-node state machine** (upgraded from 7):

```
analyze_structure → save_raw_clean → semantic_split → generate_toc → semantic_tag
    → assemble_chapters → format_chapters → save_to_chroma → extract_mindmap → END
```

| Node | Function | Description |
|------|----------|-------------|
| **1. analyze_structure** | `analyze_structure()` | AI reads full document (≤80K chars) → produces hierarchical chapter+subtopic map with character offset boundaries, document type, key themes, glossary |
| **2. save_raw_clean** | `save_raw_clean()` | Text cleanup: fix broken hyphenations, strip control chars, normalize Unicode, collapse excessive whitespace |
| **3. semantic_split** | `semantic_split()` | Uses structural map offsets to split at semantic boundaries (chapter/subtopic edges). Fallback: paragraph splitting |
| **4. generate_toc** | `generate_toc()` | Builds TOC directly from structural map — no stratified sampling. Produces `toc_with_subtopics` list |
| **5. semantic_tag** | `semantic_tag()` | Assigns chunks to chapters/subtopics via deterministic offset boundaries (100% accuracy vs old keyword scoring) |
| **6. assemble_chapters** | `assemble_chapters()` | Groups chunks by chapter+subtopic; **completeness gate** (≥92% or fallback to single chapter) |
| **7. format_chapters** | `format_chapters()` | AI formats with subtopic outline as structural guide → splits formatted Markdown into subtopic-level chunks |
| **8. save_to_chroma** | `save_to_chroma()` | Upserts **subtopic-level chunks** into ChromaDB (each with `subtopic` metadata field) |
| **9. extract_mindmap** | `extract_mindmap()` | AI extracts concept graph (nodes + edges) — failure-safe bonus step |

**Key improvements over v1 (7-node)**:
- **Full-document analysis** instead of stratified sampling → better chapter detection
- **Character offset boundaries** → deterministic chunk assignment (was: crude keyword overlap)
- **Subtopic-level chunks** in ChromaDB → much better RAG retrieval precision
- **Text cleanup node** → fixes hyphenation, OCR artifacts before any processing

**State Schema**: [`IngestionState`](backend/graphs/ingestion_graph.py) TypedDict with `structural_map`, `raw_clean_text`, `semantic_chunks`, `toc_with_subtopics`, `tagged_chunks`, `raw_chapters`, `formatted_chapters`, `subtopic_chunks`, and accumulated `errors` list.

**Public API**: `run_ingestion(raw_text, subject, topic, source_name)` → returns `{chapters, subtopic_chunks, chunks_saved, completeness_score, mindmap, errors, document_type, key_themes, glossary_terms}`.

**Ingestion Limits**:
- **Max document size**: 80,000 characters (~40 pages) — enforced in [`backend/api/ingest.py`](backend/api/ingest.py)
- **Max upload file**: 15 MB — configured in [`backend/core/config.py`](backend/core/config.py)
- **UI soft warning**: 60,000 characters for pasted text — shown in [`src/app/upload/page.tsx`](src/app/upload/page.tsx)

### Vector Store (ChromaDB)

[`backend/vectorstore/chroma_store.py`](backend/vectorstore/chroma_store.py):

- **Embedders**: `_GeminiEmbedder` (direct REST call to `gemini-embedding-001`, 3072-dim) or `_OllamaEmbedder` (nomic-embed-text, 768-dim)
- **Client**: `get_chroma_client()` → cached `chromadb.HttpClient`
- **Collection**: `_get_collection()` → `get_or_create_collection` with cosine HNSW space
- **Chunk IDs**: deterministic SHA256 hash of content → idempotent upserts
- **Metadata schema**: `{subject, topic, chapter, subtopic, source, chunk_id}` — `subtopic` added in v2 for granular retrieval
- **Public functions**:
  - `upsert_chunks(chunks, subject, topic, source)` → returns count (chunks can include `subtopic` field)
  - `query_chunks(query, subject?, top_k)` → returns ranked results with `subtopic` field and similarity scores
  - `delete_subject(subject)` / `delete_topic(subject, topic)`
  - `list_subjects()` → unique subjects with topic lists
  - `get_subject_chunks(subject)` → all chunks grouped by topic (includes `subtopic` field)

### LLM Factory

[`backend/core/llm.py`](backend/core/llm.py):

| Function | Provider | Returns |
|----------|----------|---------|
| `get_llm()` | Cloud → `ChatGoogleGenerativeAI` (Gemini) | LangChain `BaseChatModel` |
| | Local → `ChatOllama` | LangChain `BaseChatModel` |
| `get_embeddings()` | Cloud → `GoogleGenerativeAIEmbeddings` | LangChain `Embeddings` |
| | Local → `OllamaEmbeddings` | LangChain `Embeddings` |
| `generate_text()` | Either | Plain string response, supports `json_mode` binding |

### Configuration

[`backend/core/config.py`](backend/core/config.py) — Pydantic `BaseSettings`:

| Setting | Default | Description |
|---------|---------|-------------|
| `ai_provider` | `"cloud"` | `"cloud"` (Gemini) or `"local"` (Ollama) |
| `gemini_api_key` | `""` | Google API key |
| `gemini_model` | `"gemini-2.0-flash"` | Chat model |
| `gemini_embedding_model` | `"models/text-embedding-004"` | Embedding model |
| `ollama_base_url` | `"http://host.docker.internal:11434"` | Ollama endpoint |
| `ollama_model` | `"llama3"` | Ollama chat model |
| `chroma_host` | `"chromadb"` | Docker service name |
| `chroma_port` | `8000` | Internal ChromaDB port |
| `chroma_collection` | `"prepagent_kb"` | Collection name |
| `cors_origins` | `"http://localhost:3000"` | Comma-separated allowed origins |
| `max_upload_size_mb` | `15` | Max file upload size (reduced from 50 for optimal performance) |
| `max_ingest_chars` | `80000` | Max characters of extracted text the pipeline will process (~40 pages) |

---

## Data Flow: Ingestion Pipeline (v2)

```
User uploads file/YouTube/text
        │
        ▼
┌──────────────────────────────────────┐
│  Next.js /api/ingest (route.ts)     │
│  - Client-side validation:           │
│    • File ≤ 15 MB                    │
│    • Pasted text ≤ 80K chars         │
│  - Maps field names, forwards FormData│
└──────────────┬───────────────────────┘
               │ fetch → FastAPI :8000/api/ingest
               ▼
┌──────────────────────────────────────┐
│  FastAPI /api/ingest (ingest.py)    │
│  1. Validate: exactly one source     │
│  2. Route to parser                  │
│     - PDF → pdf_parser.py            │
│     - DOCX → docx_parser.py          │
│     - Image → image_parser.py        │
│     - YouTube → youtube_parser.py    │
│  2.5. Enforce max_ingest_chars (80K) │
│  3. Run LangGraph ingestion_graph    │
│     - analyze_structure (full doc)   │
│     - save_raw_clean (text cleanup)  │
│     - semantic_split (offset-based)  │
│     - generate_toc (from structure)  │
│     - semantic_tag (deterministic)   │
│     - assemble_chapters (≥92% gate)  │
│     - format_chapters (+subtopics)   │
│     - save_to_chroma (subtopic-level)│
│     - extract_mindmap (bonus)        │
│  4. Return: chapters, subtopics,     │
│     chunks, score, mindmap, errors   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  ChromaDB (chroma_store.py)          │
│  - Gemini embeddings (3072-dim)      │
│  - Deterministic content-hash IDs    │
│  - Idempotent upsert                 │
│  - Subtopic-level granularity        │
│  - Metadata: {subject, topic,        │
│    chapter, subtopic, source}        │
└──────────────────────────────────────┘
```

---

## Data Flow: RAG Retrieval

```
User queries a topic
        │
        ▼
┌──────────────────────────────────────┐
│  Next.js API Route (e.g. /api/notes)│
│  1. getAIConfigFromRequest()         │
│  2. queryKnowledgeBase() → FastAPI   │
│  3. Build context from results       │
│  4. generateText() → AI response     │
│  5. Return structured JSON           │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  FastAPI /api/query (query.py)       │
│  1. Embed query (Gemini/Ollama)      │
│  2. ChromaDB cosine similarity       │
│  3. Return top_k chunks with scores  │
└──────────────────────────────────────┘
```

---

## Storage Layer

| Store | Location | Purpose |
|-------|----------|---------|
| **ChromaDB** | Docker volume `chroma_data` | Primary vector store (embeddings + metadata) |
| **master_kb.md** | `knowledge_base/master_kb.md` | Compiled Markdown of all subjects/topics (human-readable) |
| **vector_db.json** | `knowledge_base/metadata/vector_db.json` | Local fallback chunk database (used by `lib/vector-store.ts`) |
| **highlights.json** | `knowledge_base/metadata/highlights.json` | User highlights with colors and annotations |
| **mindmaps.json** | `knowledge_base/metadata/mindmaps.json` | Concept graphs (nodes + edges) per subject/topic |
| **PYQ banks** | `knowledge_base/pyqs/{subject}_pyqs.md` | Extracted exam questions in Markdown |
| **User settings** | `localStorage` (`prepagent_settings`) | AI provider, API key, theme, LM Studio endpoint |

---

## Docker & Deployment

**[`docker-compose.yml`](docker-compose.yml)** defines 3 services on `prepagent-net` bridge network:

```
chromadb (:8001) ← backend (:8000) ← nextjs (:3000)
```

**Backend URL resolution** ([`backend-client.ts`](src/lib/backend-client.ts)):
1. `BACKEND_URL` env var
2. `NEXT_PUBLIC_BACKEND_URL` env var
3. Fallback: `http://localhost:8000`
4. Auto-corrects `//backend` → `//localhost` when not inside Docker

**Dockerfile**:
- Backend: [`backend/Dockerfile`](backend/Dockerfile) — Python + `requirements.txt`
- Frontend: [`Dockerfile.nextjs`](Dockerfile.nextjs) — Node.js multi-stage build
- Shared volume: `./knowledge_base` mounted in both backend and nextjs

**Start script**: [`start.sh`](start.sh) — `npm run dev:start`, `dev:stop`, `dev:reset`

---

## AI Provider Configuration

**User settings** ([`src/lib/settings.ts`](src/lib/settings.ts)) stored in localStorage:

```typescript
interface UserSettings {
  provider: "local" | "cloud";
  geminiApiKey: string;
  geminiModel?: string;           // "gemini-2.5-flash", "gemini-2.5-pro", etc.
  lmStudioEndpoint: string;       // "http://localhost:1234/v1"
  lmStudioModel: string;          // "local-model"
  theme: "theme-light" | "theme-dark" | "theme-sepia" | "theme-forest" | "theme-ocean";
}
```

**AI headers** sent with every request to Next.js API routes:
- `x-ai-provider`: `"local"` or `"cloud"`
- `x-gemini-api-key`: API key (cloud mode)
- `x-gemini-model`: model name
- `x-lm-studio-endpoint`: local server URL
- `x-lm-studio-model`: local model name

These are read by [`getAIConfigFromRequest()`](src/lib/ai-provider.ts) in every API route.

---

## Key Design Patterns

### 1. Anti-Hallucination Contract
All AI prompts enforce **source-only** generation. Every fact, date, and concept must come from the provided context. Examples:
- [`format_chapters()`](backend/graphs/ingestion_graph.py) — "Every word MUST come directly from the provided source text"
- [`/api/notes`](src/app/api/notes/route.ts) — "Rely ONLY on the provided Context below"
- [`/api/quiz`](src/app/api/quiz/route.ts) — "Every question must be fully answerable using ONLY the details present in the Context"

### 2. Dual AI Provider Support
Every LLM call goes through a provider-agnostic factory:
- **Cloud**: Google Gemini REST API
- **Local**: LM Studio (OpenAI-compatible endpoint) or Ollama
- Switched at runtime via `x-ai-provider` header

### 3. Graceful Degradation
- LangGraph nodes have fallbacks: if AI fails, rule-based Markdown formatting is used
- Embedding fallback: if Gemini embedding fails, returns zero vector → token similarity search
- OCR fallback: Gemini Vision → Tesseract → manual paste

### 4. Idempotent Ingestion
ChromaDB chunk IDs are **deterministic SHA256 hashes** of content. Re-uploading the same file updates existing chunks instead of creating duplicates.

### 5. Completeness Gate
The ingestion pipeline enforces ≥92% paragraph preservation. If content is lost during chapter assignment, the entire document falls back to a single chapter — **zero-loss guarantee**.

### 6. Ingestion Document Size Limits
- **Backend hard cap**: 80,000 characters of extracted text ([`config.py`](backend/core/config.py) `max_ingest_chars`)
- **File upload cap**: 15 MB ([`config.py`](backend/core/config.py) `max_upload_size_mb`)
- **Frontend soft warning**: 60,000 characters for pasted text with live counter ([`upload/page.tsx`](src/app/upload/page.tsx))
- These limits ensure optimal LLM context quality and prevent timeout/degradation

### 7. Subtopic-Level Granularity
Each document is split into chapters, then further into subtopics. Each subtopic becomes its own ChromaDB chunk with metadata `{chapter, subtopic}`. This gives 3-5x more granular RAG retrieval compared to chapter-level chunks.

---

## Subject Binder Features

The [`/subject`](src/app/subject/page.tsx) page is the most feature-rich component:

| Feature | Description |
|---------|-------------|
| **Preview tab** | Rendered Markdown with text selection highlighting |
| **Edit tab** | Raw textarea for direct Markdown editing |
| **Split tab** | Side-by-side preview + edit |
| **Visual tab** | Notion-like block editor with contentEditable blocks, floating formatting toolbar, block menus |
| **Mindmap tab** | 2D force-directed graph via `react-force-graph-2d` |
| **TTS** | Text-to-speech with voice selection, speed/pitch control, per-block reading |
| **Export** | DOCX download (HTML-to-Word), PDF print (iframe with academic styling) |
| **Highlights** | 4-color highlights with annotations, saved to `highlights.json` |
| **AI Restructure** | Selected text → AI restructures (bullets, tables, timelines) |
| **Socratic Explain** | Selected concept → 3-part Socratic explanation |
| **Typography** | 6 font choices (EB Garamond, Caveat, etc.) + adjustable page width |

---

## Future Enhancements Research (May 2026)

Based on research conducted to improve the system's graph visualizers and ingestion speed, the following technologies and architectures are recommended for future implementation:

### 1. Interactive Knowledge Graph Visualizations (Wiki Explorer / Mindmap)

Currently, the app uses a custom canvas-based force graph for the Wiki Explorer and `react-force-graph-2d` for the Subject Mindmap. To elevate these into full-featured interactive experiences (like Obsidian or Logseq), we researched the top libraries for 2024-2025:

*   **React Flow (`@xyflow/react` v12)**: The gold standard for React-based node editors and workflows. 
    *   *Pros:* Native React components, DOM-based, excellent developer experience, easy to style with Tailwind, built-in zooming/panning, and minimaps.
    *   *Cons:* Can struggle with massive datasets (1,000+ nodes) due to DOM overhead, but perfect for typical study topic graphs (10-200 nodes).
    *   *Verdict:* **Highly Recommended** if the goal is editable, interactive, UI-heavy node cards.
*   **Cytoscape.js**: The industry leader for complex graph theory and network analysis.
    *   *Pros:* Powerful layout algorithms, handles larger datasets well via Canvas, extensive analytical tools.
    *   *Cons:* Not React-native (requires wrappers or `useEffect`), steeper learning curve.
    *   *Verdict:* Recommended for purely analytical, read-only visualizations.
*   **Sigma.js (v3)**:
    *   *Pros:* WebGL rendering, handles 10,000+ nodes effortlessly.
    *   *Cons:* Overkill for most study apps unless rendering a massive global knowledge graph.

**Goal:** Migrate the custom Wiki Explorer graph and the Mindmap tab to **React Flow** to enable rich HTML nodes, dragging, minimaps, and better interaction handling while remaining native to the Next.js App Router architecture.

### 2. Scaling AI Document Ingestion (Performance)

The current 10-node LangGraph pipeline (`backend/graphs/ingestion_graph.py`) processes documents sequentially and synchronously, blocking the HTTP response. To speed this up without sacrificing quality:

*   **Background Task Queues (Producer-Consumer Pattern):**
    *   Instead of waiting for the pipeline to finish, the FastAPI endpoint (`/api/ingest`) should accept the file, save it to a staging area, and dispatch a background job.
    *   *Tools:* **ARQ** (asyncio-native Redis queue) is highly recommended for modern FastAPI apps over heavy frameworks like Celery. Alternatively, FastAPI's built-in `BackgroundTasks` can be used for a dependency-free (but less resilient) v1 implementation.
*   **LangGraph Parallel Fan-Out (Map-Reduce):**
    *   LangGraph supports concurrent execution of nodes. In our pipeline, `semantic_tag`, `format_chapters`, and `save_to_chroma` can be run in parallel for different chapters rather than sequentially.
    *   By using a Map-Reduce pattern, the graph can fan out to process multiple chapters concurrently (using `asyncio.gather` under the hood) and aggregate the results at a final reducer node.
*   **Asynchronous I/O (`asyncio`):**
    *   Ensure all LLM calls (via LangChain) and ChromaDB upserts use their `a*` asynchronous counterparts (e.g., `ainvoke`, `abatch`).
    *   This prevents the pipeline from blocking the FastAPI event loop during network waits (like Gemini API calls).
*   **Streaming Progress Updates:**
    *   While the background job runs, use Server-Sent Events (SSE) or WebSockets to stream LangGraph state changes back to the Next.js frontend, updating the user's progress bar in real-time.

**Goal:** Decouple the ingestion pipeline using ARQ/BackgroundTasks and parallelize chapter formatting via LangGraph's map-reduce capabilities to drastically reduce perceived wait times for users uploading large PDFs.

### Recent Architectural Changes (2025 Update)

1. **Graph Visualization Migration**:
   - Replaced `react-force-graph-2d` with `@xyflow/react` for rendering both the Wiki Explorer and Subject Mindmaps.
   - Introduced a unified `<ReactFlowGraph>` component that uses Dagre for automated directional layouts (Top-Bottom or Left-Right), eliminating manual coordinate management.
   - This fixes integration bugs with React Server Components/Next.js 15+ and provides superior interactivity (zoom, pan, drag, and custom node styling).

2. **Asynchronous Ingestion Pipeline**:
   - The document parsing and LangGraph pipelines have been decoupled from the synchronous HTTP request cycle.
   - A background task system (via `FastAPI.BackgroundTasks`) is now used for the `/ingest` route, providing clients with a `job_id`.
   - The frontend polls the backend `/api/jobs/{jobId}` until the ingestion completes.
   - Parallelized document chunk processing within LangGraph using `asyncio.gather()`, drastically improving ingestion speed for multi-chapter/multi-chunk documents.
