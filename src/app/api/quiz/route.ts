/**
 * POST /api/quiz
 *
 * Uses FastAPI ChromaDB for semantic retrieval, then generates MCQs via
 * the user's configured AI provider (Gemini cloud or local LM Studio).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest, generateText } from "@/lib/ai-provider";
import { queryKnowledgeBase } from "@/lib/backend-client";

export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);
    const body = await req.json();
    const { topic, subjectFilter, count = 5 } = body;

    if (!topic) {
      return NextResponse.json(
        { success: false, error: "Topic is required to generate a quiz." },
        { status: 400 }
      );
    }

    const questionCount = Math.min(Math.max(Number(count) || 5, 1), 15);

    // 1. Semantic search from ChromaDB via FastAPI
    const searchResults = await queryKnowledgeBase(topic, subjectFilter, 8);

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

    // 2. Assemble context
    const contextText = searchResults
      .map(
        (r, i) =>
          `[Chunk #${i + 1} | Source: ${r.source} | Topic: ${r.topic}]\n${r.content}`
      )
      .join("\n\n---\n\n");

    // 3. Generate MCQs with the user's LLM (anti-hallucination: strictly from context)
    const systemPrompt = `You are a professional educational examiner.
Your goal is to generate exactly ${questionCount} multiple choice questions (MCQs) based strictly on the provided study context.

Strict Guidelines:
1. Every question must be fully answerable using ONLY the details present in the Context. Do not test outside concepts, facts, or outside information.
2. Provide exactly 4 options: "A", "B", "C", and "D".
3. Provide exactly one correct option ("A", "B", "C", or "D").
4. Provide a thorough "explanation" citing the exact source file/link from the context (e.g. "[Source: cellular_bio.pdf]").
5. Do not include duplicate or highly similar questions.

Output strictly a JSON object with the following schema:
{
  "questions": [
    {
      "question": "Clear, concise academic question?",
      "options": {
        "A": "First choice",
        "B": "Second choice",
        "C": "Third choice",
        "D": "Fourth choice"
      },
      "answer": "B",
      "explanation": "Detailed explanation citing the specific source from the context."
    }
  ]
}

Ensure you output ONLY the raw JSON object and nothing else. No markdown wraps, no extra text.`;

    const prompt = `Generate exactly ${questionCount} MCQs for the topic: "${topic}".

Context from Ingested Materials:
--------------------------------
${contextText}
--------------------------------

Generate the quiz strictly using the rules above.`;

    const aiReply = await generateText(config, prompt, systemPrompt, true);

    let cleanedReply = aiReply.trim();
    if (cleanedReply.startsWith("```json")) {
      cleanedReply = cleanedReply.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanedReply.startsWith("```")) {
      cleanedReply = cleanedReply.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const quizData = JSON.parse(cleanedReply);
    const questions = quizData.questions || [];

    if (questions.length === 0) {
      throw new Error("No questions were returned by the AI generator.");
    }

    return NextResponse.json({ success: true, topic, questions });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "An unknown error occurred during quiz generation.";
    console.error("[Next.js /api/quiz]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
