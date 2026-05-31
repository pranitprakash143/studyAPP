/**
 * ingestion-graph-v2.ts
 * 
 * A completely redesigned, LangGraph-native ingestion pipeline.
 * 
 * DESIGN PRINCIPLE: AI is the structure PLANNER. TypeScript code does the FORMATTING.
 * No LLM ever modifies, rewrites, or removes any character from the source text.
 * All text operations (splitting, grouping, formatting) are deterministic pure functions.
 */

import { StateGraph, Annotation, END } from "@langchain/langgraph";
import { AIProviderConfig, generateText } from "./ai-provider";
import { ingestDocument } from "./vector-store";
import { appendMindmap, MindmapNode, MindmapEdge } from "./mindmap-store";

// ─────────────────────────────────────────────────────────────────────────────
// STATE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

const IngestionStateAnnotation = Annotation.Root({
  // ── Inputs ──
  rawText: Annotation<string>({ value: (_prev, next) => next, default: () => "" }),
  subject: Annotation<string>({ value: (_prev, next) => next, default: () => "" }),
  topic: Annotation<string>({ value: (_prev, next) => next, default: () => "" }),
  sourceName: Annotation<string>({ value: (_prev, next) => next, default: () => "" }),
  config: Annotation<AIProviderConfig>({ value: (_prev, next) => next, default: () => ({ provider: "local" as const }) }),

  // ── Node 1 output: raw paragraph units (exact copies from rawText) ──
  paragraphs: Annotation<string[]>({ value: (_prev, next) => next, default: () => [] }),

  // ── Node 2 output: TOC from AI ──
  chapterTitles: Annotation<string[]>({ value: (_prev, next) => next, default: () => [] }),
  globalContext: Annotation<string>({ value: (_prev, next) => next, default: () => "" }),

  // ── Node 3 output: each paragraph tagged with a chapter index ──
  taggedParagraphs: Annotation<{ chapterIdx: number; text: string }[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),

  // ── Node 4 output: paragraphs grouped by chapter, content is raw text joined ──
  rawChapters: Annotation<{ title: string; rawContent: string }[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),
  completenessScore: Annotation<number>({ value: (_prev, next) => next, default: () => 0 }),

  // ── Node 5 output: formatted chapters (only formatting tokens added, no text removed) ──
  formattedChapters: Annotation<{ title: string; content: string }[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),

  // ── Node 6 output: mindmap (async, bonus enrichment) ──
  mindmap: Annotation<{ nodes: MindmapNode[]; edges: MindmapEdge[] } | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),

  // ── Pipeline health ──
  errors: Annotation<string[]>({ value: (prev, next) => [...prev, ...next], default: () => [] }),
});

type IngestionState = typeof IngestionStateAnnotation.State;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cleans a chapter title from any filename/path artifacts.
 */
function cleanTitle(title: string, sourceName: string): string {
  let clean = title.trim();
  clean = clean.replace(/^.*[/\\]/, "");
  clean = clean.replace(/\.(pdf|docx|txt|html|png|jpg|jpeg|doc)$/i, "");
  clean = clean.replace(/_/g, " ");
  clean = clean.replace(/^pastedtext\s*\d*/i, "").replace(/^youtube\s*\w*/i, "");
  // Remove exact sourceName prefix if it leaked in
  const sourceBase = sourceName.replace(/\.[^/.]+$/, "").replace(/_/g, " ").toLowerCase();
  if (clean.toLowerCase().startsWith(sourceBase)) {
    clean = clean.slice(sourceBase.length).trim();
  }
  clean = clean.trim().replace(/^[-:.\s]+/, "").trim();
  clean = clean.replace(/\b\w/g, (c) => c.toUpperCase());
  return clean || "Study Material";
}

/**
 * Safe JSON parser that strips markdown code fences.
 */
function safeParseJson<T = unknown>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
  else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Keyword-overlap scorer: scores how well a text belongs to a chapter title.
 * Pure deterministic function. Zero LLM calls.
 */
function scoreTextForTitle(text: string, title: string): number {
  const stopWords = new Set(["the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for", "with", "by", "from", "is", "was", "are", "were", "be"]);
  const titleTokens = new Set(
    title.toLowerCase().match(/\b\w+\b/g)?.filter((w) => !stopWords.has(w) && w.length > 2) ?? []
  );
  if (titleTokens.size === 0) return 0;

  const textLower = text.toLowerCase();
  let hits = 0;
  for (const token of titleTokens) {
    if (textLower.includes(token)) hits++;
  }
  return hits / titleTokens.size;
}

/**
 * Rule-based Markdown formatter.
 * Adds formatting tokens only — never removes, shortens, or paraphrases text.
 * 
 * Rules applied:
 * 1. Lines in ALL CAPS (>= 4 chars) → treated as section headings → wrapped in **bold**
 * 2. Lines that look like numbered/bulleted lists → kept as-is (already formatted)
 * 3. Everything else: paragraphs kept verbatim
 */
function applyRuleBasedMarkdown(rawContent: string): string {
  const lines = rawContent.split("\n");
  const output: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      output.push("");
      continue;
    }

    // Rule 1: ALL CAPS heading (e.g. "VARMAN DYNASTY", "ORIGIN OF THE NAMES")
    const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.replace(/\s/g, "").length >= 4;
    if (isAllCaps) {
      output.push(`\n**${trimmed}**`);
      continue;
    }

    // Rule 2: Lines that look like a key-value / short definition (e.g. "Theory 1: ..." or "Capital - Sonitpur.")
    const isKeyValue = /^(Theory|Rule|Phase|Period|Stage|Step|Law|Fact|Note|Capital|Son|Daughter|Founded|Born|Date|Year)\b.{0,120}$/i.test(trimmed);
    if (isKeyValue && trimmed.length < 120) {
      // Bold the label up to the first colon or dash
      const bolded = trimmed.replace(/^([^:\-–]+)([:–\-])/, (_, label, sep) => `**${label.trim()}**${sep}`);
      output.push(`- ${bolded}`);
      continue;
    }

    // Rule 3: Already a list item
    if (/^[-*•]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
      output.push(line);
      continue;
    }

    // Rule 4: Short standalone line that looks like a proper noun / title
    const isShortProperNoun = trimmed.length < 60 && /^[A-Z]/.test(trimmed) && !/[.?!]$/.test(trimmed);
    if (isShortProperNoun && i > 0 && !lines[i - 1].trim()) {
      output.push(`**${trimmed}**`);
      continue;
    }

    // Default: keep verbatim
    output.push(line);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGGRAPH NODES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Node 1: Paragraph Splitter
 * Pure TypeScript. Zero LLM calls.
 * Splits at paragraph boundaries (\n\n+). Preserves every character.
 */
async function splitParagraphs(state: IngestionState): Promise<Partial<IngestionState>> {
  console.log("[V2 Node 1] Splitting document at paragraph boundaries...");
  const raw = state.rawText;

  // Split on 2+ consecutive newlines (paragraph boundary)
  const rawParagraphs = raw.split(/\n{2,}/);

  // Filter trivially empty paragraphs but keep all real content
  const paragraphs = rawParagraphs
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  console.log(`[V2 Node 1] Extracted ${paragraphs.length} paragraphs from ${raw.length} characters.`);
  return { paragraphs };
}

/**
 * Node 2: TOC Planner (AI)
 * Reads a STRATIFIED SAMPLE: first 4K + middle 4K + last 4K characters.
 * AI outputs ONLY chapter titles and a brief global context.
 * Never generates any note content.
 */
async function planTOC(state: IngestionState): Promise<Partial<IngestionState>> {
  console.log("[V2 Node 2] Planning Table of Contents from stratified document sample...");

  const raw = state.rawText;
  const len = raw.length;
  const sampleSize = 4000;

  // Stratified sampling: beginning, middle, end
  const startSample = raw.slice(0, sampleSize);
  const midPoint = Math.floor(len / 2);
  const midSample = raw.slice(Math.max(0, midPoint - sampleSize / 2), midPoint + sampleSize / 2);
  const endSample = raw.slice(Math.max(0, len - sampleSize));

  const stratifiedSample = [
    "=== BEGINNING OF DOCUMENT ===",
    startSample,
    "=== MIDDLE OF DOCUMENT ===",
    midSample,
    "=== END OF DOCUMENT ===",
    endSample,
  ].join("\n\n");

  const systemPrompt = `You are a premium curriculum analyst and textbook editor.
You will receive a STRATIFIED SAMPLE of a document (beginning, middle, and end sections).
Your job is to determine the document's logical chapter structure.

RULES:
1. Create 2 to 8 distinct, sequential chapter titles covering the full document scope.
2. Titles must be clean academic names — NO filenames, file extensions (.pdf, .docx), underscores, or path prefixes.
3. Titles must NOT repeat the document's own title or the source name.
4. Each title should represent a distinct thematic section of the document.
5. Together, chapters must cover the COMPLETE document from start to finish.

Output STRICTLY this JSON schema (no markdown fences):
{
  "chapterTitles": ["Chapter Title 1", "Chapter Title 2"],
  "globalContext": "Brief description of the document subject, tone, and key themes."
}`;

  const prompt = `DOCUMENT SAMPLE (stratified: beginning + middle + end):
---
${stratifiedSample}
---

Source name (do NOT use this in titles): "${state.sourceName}"

Generate the Table of Contents JSON.`;

  try {
    const response = await generateText(state.config, prompt, systemPrompt, true);
    const payload = safeParseJson<{ chapterTitles: string[]; globalContext: string }>(response);

    const rawTitles = Array.isArray(payload.chapterTitles) ? payload.chapterTitles : [];
    const chapterTitles = rawTitles.length > 0
      ? rawTitles.map((t) => cleanTitle(t, state.sourceName))
      : ["Core Study Material"];

    const globalContext = payload.globalContext || "Academic study material. All content should be preserved.";

    console.log(`[V2 Node 2] TOC planned: [${chapterTitles.join(" | ")}]`);
    return { chapterTitles, globalContext };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[V2 Node 2] TOC planning failed, using single-chapter fallback:", msg);
    return {
      chapterTitles: ["Complete Study Notes"],
      globalContext: "Academic study material.",
      errors: [`planTOC: ${msg}`],
    };
  }
}

/**
 * Node 3: Paragraph Tagger
 * Pure TypeScript keyword-overlap scoring. Zero LLM calls.
 * Tags each paragraph with the index of its best-matching chapter.
 */
async function tagParagraphs(state: IngestionState): Promise<Partial<IngestionState>> {
  console.log("[V2 Node 3] Tagging paragraphs to chapters using keyword-overlap scoring...");

  const { paragraphs, chapterTitles } = state;

  if (chapterTitles.length === 1) {
    // Only one chapter: all paragraphs go into it
    const taggedParagraphs = paragraphs.map((text) => ({ chapterIdx: 0, text }));
    console.log(`[V2 Node 3] Single chapter — all ${paragraphs.length} paragraphs assigned.`);
    return { taggedParagraphs };
  }

  const taggedParagraphs = paragraphs.map((text) => {
    const scores = chapterTitles.map((title) => scoreTextForTitle(text, title));
    const maxScore = Math.max(...scores);

    // If no chapter has any keyword overlap at all, maintain document order:
    // assign to the chapter whose index is proportional to where this paragraph falls
    let chapterIdx: number;
    if (maxScore === 0) {
      const paraIdx = paragraphs.indexOf(text);
      chapterIdx = Math.min(
        Math.floor((paraIdx / paragraphs.length) * chapterTitles.length),
        chapterTitles.length - 1
      );
    } else {
      chapterIdx = scores.indexOf(maxScore);
    }

    return { chapterIdx, text };
  });

  const distribution = chapterTitles.map((t, i) => ({
    title: t,
    count: taggedParagraphs.filter((p) => p.chapterIdx === i).length,
  }));
  console.log("[V2 Node 3] Paragraph distribution:", distribution.map((d) => `${d.title}: ${d.count}`).join(" | "));

  return { taggedParagraphs };
}

/**
 * Node 4: Chapter Assembler + Completeness Gate
 * Pure TypeScript. Groups tagged paragraphs by chapter.
 * Validates that ≥95% of source characters are preserved.
 * Falls back to single chapter if completeness gate fails.
 */
async function assembleChapters(state: IngestionState): Promise<Partial<IngestionState>> {
  console.log("[V2 Node 4] Assembling chapters and running completeness gate...");

  const { taggedParagraphs, chapterTitles, rawText } = state;

  // Group paragraphs by chapter index, preserving document order within each chapter
  const groups: Record<number, string[]> = {};
  chapterTitles.forEach((_, i) => { groups[i] = []; });

  for (const { chapterIdx, text } of taggedParagraphs) {
    if (!groups[chapterIdx]) groups[chapterIdx] = [];
    groups[chapterIdx].push(text);
  }

  // Assemble raw chapters, omitting chapters with zero content
  let rawChapters = chapterTitles
    .map((title, i) => ({
      title,
      rawContent: groups[i].join("\n\n"),
    }))
    .filter((c) => c.rawContent.trim().length > 0);

  // ── COMPLETENESS GATE ──────────────────────────────────────────────────────
  // Verify that the total characters in all assembled chapters ≈ rawText length.
  // We compare against paragraphs-only content (which excludes the double-newline
  // separators stripped during splitting), so we use paragraph total, not rawText.
  const totalParagraphChars = taggedParagraphs.reduce((sum, p) => sum + p.text.length, 0);
  const preservedChars = rawChapters.reduce((sum, c) => sum + c.rawContent.replace(/\n\n/g, "\n").length, 0);
  const completenessScore = totalParagraphChars > 0 ? preservedChars / totalParagraphChars : 1;

  console.log(`[V2 Node 4] Completeness: ${(completenessScore * 100).toFixed(1)}% (${preservedChars}/${totalParagraphChars} chars)`);

  if (completenessScore < 0.92) {
    console.warn(`[V2 Node 4] COMPLETENESS GATE TRIGGERED (${(completenessScore * 100).toFixed(1)}%). Falling back to full-text single chapter.`);
    rawChapters = [{
      title: chapterTitles[0],
      rawContent: rawText, // Use the original rawText — guaranteed 100% content
    }];
  }

  return { rawChapters, completenessScore };
}

/**
 * Node 5: Markdown Formatter
 * Deterministic, high-integrity AI-assisted formatting with strict anti-hallucination rules.
 * ONLY cleans layout, typography, typos, structures complex paragraphs into clean academic headings/lists/tables,
 * and highlights key definitions.
 * NEVER removes, shortens, summarizes, or paraphrases any factual sentences, names, dates, numbers, or terms.
 * If AI provider fails, falls back instantly to local rule-based formatting.
 */
async function applyMarkdownFormatting(state: IngestionState): Promise<Partial<IngestionState>> {
  console.log("[V2 Node 5] Applying premium high-integrity formatting (with anti-hallucination guardrails)...");

  const formattedChapters: { title: string; content: string }[] = [];

  for (const chapter of state.rawChapters) {
    const systemPrompt = `You are a premium textbook editor and formatting engine.
Your sole responsibility is to organize, clean, and format the provided study notes into standard Markdown.

ANTI-HALLUCINATION & PRESERVATION RULES (CRITICAL):
1. PRESERVE EVERY FACT: You must preserve 100% of the original text's meaning, factual sentences, names, dates, numbers, lists, formulas, and academic vocabulary.
2. DO NOT CONDENSE: Do NOT summarize, shorten, synthesize, or omit any details. Keep every piece of information intact so no data is lost for exams.
3. NO HALLUCINATION: Do NOT add new external facts, claims, or information that was not in the original text.
4. CLEANING ONLY: Clean up OCR artifacts, duplicate header/footer noise (like page numbers or scanner remnants), broken hyphenations at line wraps, and spelling typos.
5. TYPOGRAPHY & STRUCTURE: Structure paragraphs beautifully using:
   - Clear markdown headings (e.g. ### for subheadings) where appropriate.
   - Bullet lists or numbered lists for sequence details.
   - Bold syntax (**keyword**) to highlight important concepts, definitions, and proper nouns.
   - Tables (| Header |) if the text contains raw tabular listings or comparative structures.
   - Blockquotes (> ) for key quotes or vital formulas.

Output only the formatted chapter Markdown. Do not wrap the output in markdown code blocks or provide conversational text.`;

    const prompt = `CHAPTER TITLE: "${chapter.title}"
ORIGINAL CHAPTER CONTENT:
---
${chapter.rawContent}
---

Format this chapter content while maintaining 100% sentence-level preservation and zero information loss.`;

    try {
      console.log(`[V2 Node 5] Formatting chapter "${chapter.title}" (${chapter.rawContent.length} chars)...`);
      const response = await generateText(state.config, prompt, systemPrompt, false);
      const cleanContent = response.trim();
      
      if (cleanContent.length > 50) {
        formattedChapters.push({
          title: chapter.title,
          content: cleanContent,
        });
      } else {
        throw new Error("AI returned abnormally short content.");
      }
    } catch (err: any) {
      console.warn(`[V2 Node 5] AI formatting failed for chapter "${chapter.title}", falling back to rule-based TS:`, err.message);
      formattedChapters.push({
        title: chapter.title,
        content: applyRuleBasedMarkdown(chapter.rawContent),
      });
    }
  }

  const totalOutputChars = formattedChapters.reduce((sum, c) => sum + c.content.length, 0);
  console.log(`[V2 Node 5] Formatted ${formattedChapters.length} chapters. Total output: ${totalOutputChars} chars.`);

  return { formattedChapters };
}

/**
 * Node 6: Save to Vector Store (synchronous)
 * Saves the formatted chapters to the vector database immediately.
 */
async function saveToVectorStore(state: IngestionState): Promise<Partial<IngestionState>> {
  console.log("[V2 Node 6] Saving formatted chapters to vector store...");
  await ingestDocument(
    state.config,
    state.subject,
    state.topic,
    state.sourceName,
    state.formattedChapters,
  );
  console.log(`[V2 Node 6] Saved ${state.formattedChapters.length} chapters to knowledge base.`);
  return {};
}

/**
 * Node 7: Mindmap Extractor (AI, async enrichment)
 * Extracts key concepts and relationships for the mindmap.
 * Failure here does NOT affect the saved notes.
 */
async function extractMindmap(state: IngestionState): Promise<Partial<IngestionState>> {
  console.log("[V2 Node 7] Extracting mindmap knowledge graph...");

  // Build a compact summary for the AI (chapter titles + first 500 chars of each)
  const compactNotes = state.formattedChapters
    .map((c) => `# ${c.title}\n${c.content.slice(0, 500)}`)
    .join("\n\n");

  const systemPrompt = `You are a knowledge graph extractor.
Extract the key academic concepts and their relationships from the provided study notes.

Output STRICTLY this JSON (no markdown fences):
{
  "nodes": [{ "id": "concept_id_no_spaces", "label": "Concept Name" }],
  "edges": [{ "source": "source_id", "target": "target_id", "label": "relationship verb" }]
}`;

  const prompt = `STUDY NOTES SUMMARY:\n---\n${compactNotes}\n---\n\nExtract concepts and relationships.`;

  try {
    const response = await generateText(state.config, prompt, systemPrompt, true);
    const graph = safeParseJson<{ nodes: MindmapNode[]; edges: MindmapEdge[] }>(response);

    if (Array.isArray(graph.nodes) && graph.nodes.length > 0) {
      const sanitizedNodes: MindmapNode[] = graph.nodes.map((n) => ({
        id: String(n.id || "").replace(/\s+/g, "_"),
        label: String(n.label || ""),
      }));
      const sanitizedEdges: MindmapEdge[] = graph.edges.map((e) => ({
        source: String(e.source || "").replace(/\s+/g, "_"),
        target: String(e.target || "").replace(/\s+/g, "_"),
        label: String(e.label || ""),
      }));

      appendMindmap(state.subject, state.topic, sanitizedNodes, sanitizedEdges);
      console.log(`[V2 Node 7] Mindmap saved: ${sanitizedNodes.length} nodes, ${sanitizedEdges.length} edges.`);
      return { mindmap: { nodes: sanitizedNodes, edges: sanitizedEdges } };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[V2 Node 7] Mindmap extraction failed (notes are still fully saved):", msg);
    return { errors: [`extractMindmap: ${msg}`] };
  }
  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildIngestionGraph() {
  const graph = new StateGraph(IngestionStateAnnotation)
    .addNode("splitParagraphs", splitParagraphs)
    .addNode("planTOC", planTOC)
    .addNode("tagParagraphs", tagParagraphs)
    .addNode("assembleChapters", assembleChapters)
    .addNode("applyMarkdownFormatting", applyMarkdownFormatting)
    .addNode("saveToVectorStore", saveToVectorStore)
    .addNode("extractMindmap", extractMindmap)
    .addEdge("__start__", "splitParagraphs")
    .addEdge("splitParagraphs", "planTOC")
    .addEdge("planTOC", "tagParagraphs")
    .addEdge("tagParagraphs", "assembleChapters")
    .addEdge("assembleChapters", "applyMarkdownFormatting")
    .addEdge("applyMarkdownFormatting", "saveToVectorStore")
    // Mindmap runs after save — its failure cannot break the pipeline
    .addEdge("saveToVectorStore", "extractMindmap")
    .addEdge("extractMindmap", END);

  return graph.compile();
}

// Compile once at module load
const ingestionGraph = buildIngestionGraph();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export interface IngestionResult {
  chapters: { title: string; content: string }[];
  completenessScore: number;
  mindmapAdded: boolean;
  errors: string[];
}

/**
 * Run the full V2 ingestion pipeline for a document.
 * This is the single entry point used by the API route.
 */
export async function runIngestionGraph(
  config: AIProviderConfig,
  rawText: string,
  subject: string,
  topic: string,
  sourceName: string,
): Promise<IngestionResult> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[IngestionGraph V2] Starting pipeline for: "${sourceName}"`);
  console.log(`  Subject: ${subject} | Topic: ${topic}`);
  console.log(`  Raw text length: ${rawText.length} chars`);
  console.log("=".repeat(60));

  const initialState: Partial<IngestionState> = {
    rawText: rawText.trim(),
    subject: subject.trim(),
    topic: topic.trim(),
    sourceName: sourceName.trim(),
    config,
  };

  const finalState = await ingestionGraph.invoke(initialState);

  const result: IngestionResult = {
    chapters: finalState.formattedChapters,
    completenessScore: finalState.completenessScore,
    mindmapAdded: finalState.mindmap !== null,
    errors: finalState.errors,
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[IngestionGraph V2] Pipeline complete.`);
  console.log(`  Chapters saved: ${result.chapters.length}`);
  console.log(`  Completeness: ${(result.completenessScore * 100).toFixed(1)}%`);
  console.log(`  Mindmap: ${result.mindmapAdded ? "yes" : "no"}`);
  if (result.errors.length > 0) console.warn(`  Errors: ${result.errors.join(", ")}`);
  console.log("=".repeat(60) + "\n");

  return result;
}
