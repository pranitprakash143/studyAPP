import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest, generateText } from "@/lib/ai-provider";

export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);
    const body = await req.json();
    const { text, style, customInstruction } = body;

    if (!text) {
      return NextResponse.json(
        { success: false, error: "Text to restructure is required." },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert academic editor and text restructuring engine.
Your sole purpose is to take a raw segment of student study notes and restructure it to maximize readability, retention, and visual appeal.

Follow these strict rules:
1. STRICT ANTI-HALLUCINATION: Rely ONLY on the facts, concepts, dates, numbers, and definitions present in the provided notes. DO NOT add any outside facts, external knowledge, or details. Factual accuracy as per the original content is paramount.
2. CONCISE SENTENCE REORGANIZATION: Compress and reorganize the sentences to be extremely concise. Eliminate wordiness, verbose styling, and repetitive filler. Drastically shorten the character and word counts, ensuring that the EXACT same facts, details, numbers, and core meanings are completely preserved. The output must deliver the identical information density, but using far fewer, highly compressed words.
3. EXTREME VISUAL LAYOUTS: Whenever appropriate, convert the text into premium study structures:
   - Markdown comparison tables if comparing two or more entities
   - High-yield structured bullet lists with nested sub-bullets for causes, features, or effects
   - Step-by-step timelines or flows for sequential processes
   - Key Facts callout boxes using markdown blockquotes (e.g. "> ⚡ Key Revision Fact: ...")
4. Preserving Terminology: Keep exact terminologies, numbers, and historical names. Keep the academic integrity 100% intact.
5. Output Format: Return ONLY the restructured markdown segment. Do not write introductory text, pleasantries, or explanations. Start immediately with the restructured markdown.`;

    let prompt = `Restructure the following segment of study notes:
"${text}"

Target Layout Format Style: ${style || "bullets"}
${customInstruction ? `Specific formatting instruction to apply: "${customInstruction}"` : ""}

Generate the beautifully organized, factually correct, and structured markdown now:`;

    const restructured = await generateText(config, prompt, systemPrompt, false);

    return NextResponse.json({
      success: true,
      restructured: restructured.trim(),
    });
  } catch (error: any) {
    console.error("[Next.js POST /api/notes/restructure]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
