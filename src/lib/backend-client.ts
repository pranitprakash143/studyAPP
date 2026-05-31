/**
 * src/lib/backend-client.ts
 *
 * Typed HTTP client for the Python FastAPI backend (running at port 8000).
 * All Next.js API routes use this instead of reading vector_db.json directly.
 *
 * URL resolution priority:
 *  1. BACKEND_URL env var (set in .env)
 *  2. NEXT_PUBLIC_BACKEND_URL env var
 *  3. Fallback: http://localhost:8000
 *
 * Common gotcha: If running `npm run dev` on your Mac host (not inside Docker),
 * BACKEND_URL must be http://localhost:8000, NOT http://backend:8000.
 * The hostname 'backend' only resolves inside the Docker network.
 */

import fs from "fs";

// ── Resolve backend URL with Docker-hostname guard ────────────────────────────
const _rawBackendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

// Detect if we're running inside a Docker container (/.dockerenv exists in containers)
const _isInsideDocker = fs.existsSync("/.dockerenv");

// Auto-correct Docker-internal hostname when running on the host machine
const BACKEND_URL =
  !_isInsideDocker && _rawBackendUrl.includes("//backend")
    ? _rawBackendUrl.replace("//backend", "//localhost")
    : _rawBackendUrl;

if (!_isInsideDocker && _rawBackendUrl.includes("//backend")) {
  console.warn(
    `[backend-client] BACKEND_URL='${_rawBackendUrl}' uses a Docker-internal hostname. ` +
      `Auto-corrected to '${BACKEND_URL}' for local dev. ` +
      `Set BACKEND_URL=http://localhost:8000 in .env to remove this warning.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types matching FastAPI response schemas
// ─────────────────────────────────────────────────────────────────────────────

export interface BackendChapter {
  title: string;
  preview?: string;
  content?: string;
}

export interface BackendIngestResponse {
  success: boolean;
  source: string;
  subject: string;
  topic: string;
  chunks_added: number;
  completeness_score: number;
  chapters: BackendChapter[];
  mindmap?: object | null;
  warnings?: string[];
}

export interface BackendQueryResult {
  content: string;
  subject: string;
  topic: string;
  chapter: string;
  source: string;
  chunk_id: string;
  score: number;
}

export interface BackendQueryResponse {
  query: string;
  results: BackendQueryResult[];
  count: number;
}

export interface BackendSubjectSummary {
  subject: string;
  topic_count: number;
  topics: string[];
}

export interface BackendSubjectsResponse {
  subjects: BackendSubjectSummary[];
  count: number;
}

export interface BackendSubjectChunk {
  content: string;
  topic: string;
  chapter: string;
  source: string;
}

export interface BackendSubjectResponse {
  subject: string;
  topic_count: number;
  topics: Record<string, BackendSubjectChunk[]>;
}

export interface BackendHealthResponse {
  status: string;
  service: string;
  version: string;
  ai_provider: string;
  chromadb: { status: string; heartbeat?: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Client functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if the backend service is reachable.
 */
export async function checkBackendHealth(): Promise<BackendHealthResponse> {
  const res = await fetch(`${BACKEND_URL}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Backend health check failed: ${res.status}`);
  return res.json();
}

/**
 * Proxy an ingestion FormData request straight to the FastAPI backend.
 * The backend handles parsing, LangGraph pipeline, and ChromaDB upsert.
 */
export async function proxyIngest(
  formData: FormData
): Promise<BackendIngestResponse> {
  const res = await fetch(`${BACKEND_URL}/api/ingest`, {
    method: "POST",
    body: formData,
    // Do NOT set Content-Type manually — fetch sets the correct multipart boundary
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || data.error || `Ingest failed: ${res.status}`);
  }
  return data;
}

/**
 * Semantic search over ChromaDB via the FastAPI backend.
 */
export async function queryKnowledgeBase(
  query: string,
  subject?: string,
  topK: number = 6
): Promise<BackendQueryResult[]> {
  const res = await fetch(`${BACKEND_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, subject: subject || null, top_k: topK }),
    cache: "no-store",
  });

  const data: BackendQueryResponse = await res.json();
  if (!res.ok) {
    throw new Error((data as any).detail || `Query failed: ${res.status}`);
  }
  return data.results;
}

/**
 * List all subjects with topic counts from ChromaDB.
 */
export async function listSubjects(): Promise<BackendSubjectSummary[]> {
  const res = await fetch(`${BACKEND_URL}/api/subjects`, {
    cache: "no-store",
  });
  const data: BackendSubjectsResponse = await res.json();
  if (!res.ok) throw new Error(`List subjects failed: ${res.status}`);
  return data.subjects;
}

/**
 * Get all chunks for a subject, grouped by topic.
 */
export async function getSubjectChunks(
  subject: string
): Promise<BackendSubjectResponse> {
  const res = await fetch(
    `${BACKEND_URL}/api/subject/${encodeURIComponent(subject)}`,
    { cache: "no-store" }
  );

  if (res.status === 404) {
    return { subject, topic_count: 0, topics: {} };
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Get subject failed: ${res.status}`);
  return data;
}

/**
 * Delete all chunks for a subject (or a specific topic within it).
 */
export async function deleteSubject(
  subject: string,
  topic?: string
): Promise<{ deleted: number }> {
  const url = topic
    ? `${BACKEND_URL}/api/subject/${encodeURIComponent(subject)}/topic/${encodeURIComponent(topic)}`
    : `${BACKEND_URL}/api/subject/${encodeURIComponent(subject)}`;

  const res = await fetch(url, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Delete failed: ${res.status}`);
  return data;
}

/**
 * Direct chunk-saving endpoint to bypass raw text ingestion for note edits.
 */
export async function saveSubjectNotesDirectly(
  subject: string,
  chunks: { title: string; content: string }[]
): Promise<{ success: boolean; chunks_added: number }> {
  const res = await fetch(
    `${BACKEND_URL}/api/subject/${encodeURIComponent(subject)}/save`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunks }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Save notes failed: ${res.status}`);
  return data;
}
