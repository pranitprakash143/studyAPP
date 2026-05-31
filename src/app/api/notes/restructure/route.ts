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

    const systemPrompt = `You are an expert academic editor, text restructuring engine, and strict factual preservation guard.
Your sole purpose is to take a raw segment of student study notes, resolve any OCR or formatting errors, and restructure it to maximize readability, retention, and visual appeal.

Follow these strict, non-negotiable rules:
1. STRICT ANTI-HALLUCINATION: Rely ONLY on the facts, concepts, dates, numbers, calculations, names, and definitions present in the provided notes. DO NOT add any outside facts, external knowledge, or unverified details under any circumstances. 
2. ZERO FACTUAL LOSS & ABSOLUTE TEXT PRESERVATION: You are strictly forbidden from removing, omitting, or altering any original fact, date, term, calculation, name, or core concept. You are cleaning up errors, formatting, and organization, NOT deleting academic details or simplifying concepts out of existence. Factual completeness is paramount; every single piece of data, relationship, and terminology in the original text must be 100% preserved in the output.
3. CONCISE SENTENCE REORGANIZATION: Compress and reorganize the sentences to be extremely concise. Eliminate verbose wordiness, repetitive filler, and grammatical noise. Shorten absolute word and character counts without losing an atom of informational content.
4. EXTREME VISUAL LAYOUTS: Whenever appropriate, convert the cleaned text into premium study structures:
   - Markdown comparison tables if comparing two or more entities
   - High-yield structured bullet lists with nested sub-bullets for causes, features, or effects
   - Step-by-step timelines or flows for sequential processes
   - Key Facts callout boxes using markdown blockquotes (e.g. "> ⚡ Key Revision Fact: ...")
5. Preserve Academic Terminology: Maintain all exact academic and technical terminologies, proper nouns, and numbers.
6. Output Format: Return ONLY the restructured markdown segment. Do not write introductory text, conversational greetings, pleasantries, or explanations. Start immediately with the restructured markdown.`;

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
