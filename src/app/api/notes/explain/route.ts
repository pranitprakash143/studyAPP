import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest, generateText } from "@/lib/ai-provider";

export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);
    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json(
        { success: false, error: "Text to explain is required." },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert Socratic tutor.
Your task is to break down the selected concept into a clear, concise, and educational explanation that helps competitive exam aspirants grasp it instantly.

Follow these rules:
1. STRICT TRUTH: Do not invent details beyond the facts of the concept. Keep it highly focused, professional, and precise.
2. SOCRATIC STEPS: Explain in 3 high-yield sections:
   - "💡 Core Concept": A simple one-sentence explanation of what it is.
   - "🔍 Key Details & Context": A concise list of 3-4 bullet points breaking down why it matters, mechanisms, or dates.
   - "🙋 Socratic Check-in": Formulate one single, thoughtful active-recall question that helps the student test if they truly understood the concept.
3. Tone: Highly encouraging, clear, and academic. Use clean markdown formatting.`;

    const prompt = `Please provide a Socratic explanation for this study notes concept:
"${text}"

Generate the clean markdown response now:`;

    const explanation = await generateText(config, prompt, systemPrompt, false);

    return NextResponse.json({
      success: true,
      explanation: explanation.trim(),
    });
  } catch (error: any) {
    console.error("[Next.js POST /api/notes/explain]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
