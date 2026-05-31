import fs from "fs";
import path from "path";

export interface Chunk {
  id: string;
  subject: string;
  topic: string;
  source: string;
  content: string;
  embedding?: number[];
  timestamp: string;
}

const KB_DIR = path.join(process.cwd(), "knowledge_base");
const METADATA_DIR = path.join(KB_DIR, "metadata");
const MASTER_KB_PATH = path.join(KB_DIR, "master_kb.md");
const VECTOR_DB_PATH = path.join(METADATA_DIR, "vector_db.json");

// Ensure directories exist
function ensureDirsExist() {
  if (!fs.existsSync(KB_DIR)) {
    fs.mkdirSync(KB_DIR, { recursive: true });
  }
  if (!fs.existsSync(METADATA_DIR)) {
    fs.mkdirSync(METADATA_DIR, { recursive: true });
  }
}

// Load chunks database
export function loadVectorDb(): Chunk[] {
  ensureDirsExist();
  if (fs.existsSync(VECTOR_DB_PATH)) {
    try {
      const data = fs.readFileSync(VECTOR_DB_PATH, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      console.error("Error reading vector DB:", e);
      return [];
    }
  }
  return [];
}

// Token-overlap similarity (for zero-dependency local text search fallback)
function tokenSimilarity(query: string, text: string): number {
  const queryTokens = new Set(query.toLowerCase().match(/\w+/g) || []);
  const textTokens = text.toLowerCase().match(/\w+/g) || [];
  if (queryTokens.size === 0 || textTokens.length === 0) return 0;

  const textTokenSet = new Set(textTokens);
  let intersection = 0;
  for (const token of queryTokens) {
    if (textTokenSet.has(token)) {
      intersection++;
    }
  }
  
  return intersection / (queryTokens.size + textTokenSet.size - intersection);
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

/**
 * Fallback semantic-ish search for local offline mode.
 * Performs zero-dependency token-overlap matching.
 */
export async function searchKnowledgeBase(
  config: unknown, // Kept in signature for backwards compatibility
  query: string,
  subjectFilter?: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const chunks = loadVectorDb();
  if (chunks.length === 0) return [];

  let filtered = chunks;
  if (subjectFilter && subjectFilter !== "All") {
    filtered = chunks.filter(c => c.subject.toLowerCase() === subjectFilter.toLowerCase());
  }

  const results: SearchResult[] = [];

  for (const chunk of filtered) {
    const contentScore = tokenSimilarity(query, chunk.content);
    const topicScore = tokenSimilarity(query, chunk.topic) * 1.5;
    const subjectScore = tokenSimilarity(query, chunk.subject) * 1.2;
    const score = Math.max(contentScore, topicScore, subjectScore);

    results.push({ chunk, score });
  }

  return results
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Get list of unique subjects present in the local database
export function getUniqueSubjects(): string[] {
  const chunks = loadVectorDb();
  const subjects = new Set<string>();
  for (const c of chunks) {
    subjects.add(c.subject);
  }
  return Array.from(subjects);
}

// Retrieve local compiled master_kb content
export function getMasterKbContent(): string {
  ensureDirsExist();
  if (fs.existsSync(MASTER_KB_PATH)) {
    return fs.readFileSync(MASTER_KB_PATH, "utf-8");
  }
  return "*Knowledge Base is empty. Please upload materials to begin.*";
}
