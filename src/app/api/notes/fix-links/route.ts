import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest, generateText } from "@/lib/ai-provider";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);
    const body = await req.json();
    const { markdown } = body;

    if (!markdown) {
      return NextResponse.json(
        { success: false, error: "Markdown content is required." },
        { status: 400 }
      );
    }

    const headingsOnly = markdown
      .split("\n")
      .filter((line: string) => line.trim().startsWith("##") || line.trim().startsWith("* **Sources**:"))
      .join("\n");

    const systemPrompt = `You are a precise document structure analyzer.
Extract the chapter structure from the markdown headings below.

Rules:
1. Each "## ..." line is a chapter heading.
2. If a heading starts with "Topic:" (e.g., "## Topic: Ancient India"), the chapter name is after "Topic:".
3. Each "### ..." line after a chapter heading is a subsection.
4. Preserve the exact heading text for scrolling anchors.
5. If the same chapter name repeats, make each unique by appending a number.

Output strictly a JSON object with this schema:
{
  "topics": [
    {
      "name": "Clean chapter name (without Topic: prefix)",
      "fullName": "Exact heading text as it appears after ##",
      "subsections": [
        { "name": "Subsection name", "fullName": "Exact text after ###" }
      ]
    }
  ]
}

Output ONLY the raw JSON. No markdown wraps, no extra text.`;

    const prompt = `Extract chapter structure from these headings:

${headingsOnly || markdown}

Return the JSON now.`;

    const aiReply = await generateText(config, prompt, systemPrompt, true);

    let cleanedReply = aiReply.trim();
    if (cleanedReply.startsWith("```json")) {
      cleanedReply = cleanedReply.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanedReply.startsWith("```")) {
      cleanedReply = cleanedReply.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const data = JSON.parse(cleanedReply);
    const topics = data.topics || [];

    return NextResponse.json({ success: true, topics });
  } catch (error: any) {
    console.error("[Next.js POST /api/notes/fix-links]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
