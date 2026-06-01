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
import { headers as getRequestHeaders } from "next/headers";

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

export interface IngestRequest {
  subject: string;
  topic: string;
  file?: File | null;
  youtubeUrl?: string | null;
  pastedText?: string | null;
}

export interface BackendChapter {
  title: string;
  preview?: string;
  content?: string;
}

export interface BackendIngestResponse {
  success: boolean;
  status?: string;
  job_id?: string;
  message?: string;
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
  subtopic: string;
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
  subtopic: string;
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
// Helper Utilities for Stability and Forwarding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely gathers AI API credential headers from the Next.js active request context.
 */
async function getForwardedHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  try {
    const contextHeaders = await getRequestHeaders();
    const targetKeys = [
      "x-ai-provider",
      "x-openai-api-key",
      "x-openai-model",
      "x-gemini-api-key",
      "x-gemini-model",
      "x-ai-api-key",
      "x-ai-model",
      "x-groq-api-key",
      "x-groq-model",
      "x-openrouter-api-key",
      "x-openrouter-model",
      "x-mistral-api-key",
      "x-mistral-model",
      "x-deepseek-api-key",
      "x-deepseek-model",
      "x-lm-studio-endpoint",
      "x-lm-studio-model"
    ];
    for (const key of targetKeys) {
      const val = contextHeaders.get(key);
      if (val) {
        headers[key] = val;
      }
    }
  } catch {
    // Graceful fallback when outside active API route context (e.g. static compile checks)
  }
  return headers;
}

/**
 * Safe parser for HTTP responses to avoid JSON parsing crashes on Bad Gateway HTML pages.
 */
async function safeParseResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type");
  let data: any = null;
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      // Ignore JSON parse errors
    }
  }
  if (!res.ok) {
    throw new Error(
      data?.detail || 
      data?.error || 
      `HTTP Error ${res.status}: ${res.statusText || "Connection Refused"}`
    );
  }
  return data as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Client functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if the backend service is reachable.
 */
export async function checkBackendHealth(): Promise<BackendHealthResponse> {
  const res = await fetch(`${BACKEND_URL}/health`, { 
    cache: "no-store",
    headers: await getForwardedHeaders()
  });
  return safeParseResponse<BackendHealthResponse>(res);
}

/**
 * Proxy an ingestion request straight to the FastAPI backend.
 * Accepts IngestRequest or FormData, assembling and mapping keys dynamically.
 * The backend handles parsing, LangGraph pipeline, and ChromaDB upsert.
 */
export async function proxyIngest(
  input: IngestRequest | FormData
): Promise<BackendIngestResponse> {
  let body: FormData;

  if (input instanceof FormData) {
    body = input;
  } else {
    body = new FormData();
    body.append("subject", input.subject);
    body.append("topic", input.topic);

    if (input.file) {
      body.append("file", input.file, input.file.name);
    } else if (input.youtubeUrl) {
      body.append("youtube_url", input.youtubeUrl.trim());
    } else if (input.pastedText) {
      body.append("pasted_text", input.pastedText.trim());
    }
  }

  const res = await fetch(`${BACKEND_URL}/api/ingest`, {
    method: "POST",
    headers: await getForwardedHeaders(),
    body,
    // Do NOT set Content-Type manually — fetch sets the correct multipart boundary
  });

  return safeParseResponse<BackendIngestResponse>(res);
}

/**
 * Semantic search over ChromaDB via the FastAPI backend.
 * Uses HyDE retrieval by default (use_hyde=true) for better recall.
 */
export async function queryKnowledgeBase(
  query: string,
  subject?: string,
  topK: number = 6,
  useHyDE: boolean = true
): Promise<BackendQueryResult[]> {
  const res = await fetch(`${BACKEND_URL}/api/query`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...await getForwardedHeaders()
    },
    body: JSON.stringify({ query, subject: subject || null, top_k: topK, use_hyde: useHyDE }),
    cache: "no-store",
  });

  const data = await safeParseResponse<BackendQueryResponse>(res);
  return data.results;
}

/**
 * List all subjects with topic counts from ChromaDB.
 */
export async function listSubjects(): Promise<BackendSubjectSummary[]> {
  const res = await fetch(`${BACKEND_URL}/api/subjects`, {
    cache: "no-store",
    headers: await getForwardedHeaders()
  });
  const data = await safeParseResponse<BackendSubjectsResponse>(res);
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
    { 
      cache: "no-store",
      headers: await getForwardedHeaders()
    }
  );

  if (res.status === 404) {
    return { subject, topic_count: 0, topics: {} };
  }

  return safeParseResponse<BackendSubjectResponse>(res);
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

  const res = await fetch(url, { 
    method: "DELETE",
    headers: await getForwardedHeaders()
  });
  return safeParseResponse<{ deleted: number }>(res);
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
      headers: { 
        "Content-Type": "application/json",
        ...await getForwardedHeaders()
      },
      body: JSON.stringify({ chunks }),
    }
  );
  return safeParseResponse<{ success: boolean; chunks_added: number }>(res);
}
