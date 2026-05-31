import fs from "fs";
import path from "path";
import { AIProviderConfig, embedText } from "./ai-provider";

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

// Save chunks database
export function saveVectorDb(chunks: Chunk[]) {
  ensureDirsExist();
  fs.writeFileSync(VECTOR_DB_PATH, JSON.stringify(chunks, null, 2), "utf-8");
}

// Recompile master_kb.md based on current chunks in DB
export function rebuildMasterKb(chunks: Chunk[]) {
  ensureDirsExist();
  
  // Group chunks by subject, then by topic
  const grouped: Record<string, Record<string, Chunk[]>> = {};

  for (const chunk of chunks) {
    if (!grouped[chunk.subject]) {
      grouped[chunk.subject] = {};
    }
    if (!grouped[chunk.subject][chunk.topic]) {
      grouped[chunk.subject][chunk.topic] = [];
    }
    grouped[chunk.subject][chunk.topic].push(chunk);
  }

  let markdown = `# PrepAgent Master Knowledge Base\n\nGenerated on: ${new Date().toLocaleDateString()}\n\n`;

  for (const [subject, topics] of Object.entries(grouped)) {
    markdown += `# Subject: ${subject}\n\n`;
    
    for (const [topic, topicChunks] of Object.entries(topics)) {
      markdown += `## Topic: ${topic}\n`;
      // Deduplicate sources
      const sources = Array.from(new Set(topicChunks.map(c => c.source)));
      markdown += `* **Sources**: ${sources.join(", ")}\n\n`;
      
      // Concatenate content
      for (const chunk of topicChunks) {
        markdown += `${chunk.content}\n\n`;
      }
      markdown += `---\n\n`;
    }
  }

  fs.writeFileSync(MASTER_KB_PATH, markdown, "utf-8");
}

// Add chunks from a newly ingested file
export async function ingestDocument(
  config: AIProviderConfig,
  subject: string,
  topic: string,
  source: string,
  sections: { title: string; content: string }[]
) {
  const chunks = loadVectorDb();
  
  // Remove existing chunks from the same source to prevent duplicates if re-uploaded
  const filteredChunks = chunks.filter(c => c.source !== source);

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const chunkContent = sec.content.trim();
    if (!chunkContent) continue;

    const id = `${source.replace(/\s+/g, "_")}_${Date.now()}_${i}`;

    let embedding: number[] | undefined;
    if (config.provider === "cloud") {
      try {
        embedding = await embedText(config, chunkContent);
      } catch (err) {
        console.error("Embedding generation failed for chunk, saving without it:", err);
      }
    }

    filteredChunks.push({
      id,
      subject: subject.trim(),
      topic: `${topic.trim()} - ${sec.title.trim()}`,
      source,
      content: chunkContent,
      embedding,
      timestamp: new Date().toISOString(),
    });
  }

  saveVectorDb(filteredChunks);
  rebuildMasterKb(filteredChunks);
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  if (mA === 0 || mB === 0) return 0;
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

// Token-overlap similarity (for zero-dependency local text search)
function tokenSimilarity(query: string, text: string): number {
  const queryTokens = new Set(query.toLowerCase().match(/\w+/g) || []);
  const textTokens = text.toLowerCase().match(/\w+/g) || [];
  if (queryTokens.size === 0 || textTokens.length === 0) return 0;

  let matches = 0;
  for (const token of textTokens) {
    if (queryTokens.has(token)) {
      matches++;
    }
  }

  // Jaccard similarity or term frequency boost
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

// Search chunks
export async function searchKnowledgeBase(
  config: AIProviderConfig,
  query: string,
  subjectFilter?: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const chunks = loadVectorDb();
  if (chunks.length === 0) return [];

  let queryEmbedding: number[] | undefined;
  if (config.provider === "cloud") {
    try {
      queryEmbedding = await embedText(config, query);
    } catch (e) {
      console.error("Query embedding failed, falling back to local token match:", e);
    }
  }

  let filtered = chunks;
  if (subjectFilter && subjectFilter !== "All") {
    filtered = chunks.filter(c => c.subject.toLowerCase() === subjectFilter.toLowerCase());
  }

  const results: SearchResult[] = [];

  for (const chunk of filtered) {
    let score = 0;

    if (queryEmbedding && chunk.embedding && chunk.embedding.length > 0) {
      score = cosineSimilarity(queryEmbedding, chunk.embedding);
    } else {
      // Fallback or Local Mode: search by token similarity
      // Let's boost match in topic or subject as well
      const contentScore = tokenSimilarity(query, chunk.content);
      const topicScore = tokenSimilarity(query, chunk.topic) * 1.5;
      const subjectScore = tokenSimilarity(query, chunk.subject) * 1.2;
      score = Math.max(contentScore, topicScore, subjectScore);
    }

    results.push({ chunk, score });
  }

  // Sort descending by score, filter out 0 scores if no embeddings
  return results
    .filter(r => r.score > 0 || queryEmbedding !== undefined)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Get lists of all unique subjects
export function getUniqueSubjects(): string[] {
  const chunks = loadVectorDb();
  const subjects = new Set<string>();
  for (const c of chunks) {
    subjects.add(c.subject);
  }
  return Array.from(subjects);
}

// Get the master Markdown file contents
export function getMasterKbContent(): string {
  ensureDirsExist();
  if (fs.existsSync(MASTER_KB_PATH)) {
    return fs.readFileSync(MASTER_KB_PATH, "utf-8");
  }
  return "*Knowledge Base is empty. Please upload materials to begin.*";
}
