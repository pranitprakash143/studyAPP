/**
 * /api/notes — GET and POST
 *
 * GET  → Returns knowledge base stats from FastAPI
 * POST → Semantic retrieval from FastAPI + note generation via user's LLM
 */
import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest, generateText } from "@/lib/ai-provider";
import { queryKnowledgeBase, listSubjects } from "@/lib/backend-client";

// ── POST /api/notes — generate AI study notes ─────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);
    const body = await req.json();
    const { query, subjectFilter } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: "Query is required to generate notes." },
        { status: 400 }
      );
    }

    // 1. Semantic retrieval from ChromaDB via FastAPI
    const searchResults = await queryKnowledgeBase(query, subjectFilter, 6);

    if (searchResults.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No matching material found in your knowledge base. Please upload relevant files first!",
        },
        { status: 404 }
      );
    }

    // 2. Build context from retrieved chunks
    const contextText = searchResults
      .map(
        (r, i) =>
          `[Chunk #${i + 1} | Source: ${r.source} | Subject: ${r.subject} | Topic: ${r.topic}]\n${r.content}`
      )
      .join("\n\n---\n\n");

    const uniqueSources = Array.from(new Set(searchResults.map((r) => r.source)));

    // 3. Generate high-yield notes with anti-hallucination prompt
    const systemPrompt = `You are PrepAgent, a highly academic study assistant.
Your task is to synthesize high-yield revision notes on the user's requested topic, based strictly on the provided context.

Follow these strict rules:
1. Rely ONLY on the provided Context below.
2. DO NOT hallucinate, assume, or pull outside facts, dates, or details. If the context does not contain information to address a topic, state that clearly rather than inventing facts.
3. Every main point or summary section must explicitly cite its source from the context, e.g. [Source: file.pdf] or [Source: YouTube_12345].
4. Format your notes beautifully in Markdown: Use titles, structured bullet points, bold key terms, and formatted tables for comparisons if relevant.
5. Provide a "Glossary/Key Terms" section at the end, and a "High-Yield Summary" box at the top.`;

    const prompt = `Synthesize high-yield study notes for: "${query}".

Context from Ingested Materials:
--------------------------------
${contextText}
--------------------------------

Generate the notes strictly using the rules above.`;

    const generatedNotes = await generateText(config, prompt, systemPrompt, false);

    return NextResponse.json({
      success: true,
      topic: query,
      notes: generatedNotes,
      sourcesUsed: uniqueSources,
      retrievedChunksCount: searchResults.length,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "An unknown error occurred during note generation.";
    console.error("[Next.js POST /api/notes]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── GET /api/notes — return KB stats ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const subjects = await listSubjects();

    const allSubjectNames = subjects.map((s) => s.subject);
    const totalTopics = subjects.reduce((acc, s) => acc + s.topic_count, 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalSubjects: subjects.length,
        totalSources: totalTopics, // approximate: 1 source per topic
        totalChunks: totalTopics,  // approximate until backend exposes chunk count
        masterKbSizeBytes: 0,
        subjects: allSubjectNames,
        sources: allSubjectNames,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load KB stats.";
    console.error("[Next.js GET /api/notes]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
