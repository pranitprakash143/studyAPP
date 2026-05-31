import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest, generateText } from "@/lib/ai-provider";
import { loadVectorDb } from "@/lib/vector-store";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);
    const body = await req.json();
    const { subject } = body;

    if (!subject) {
      return NextResponse.json({ success: false, error: "Subject parameter is required for analysis." }, { status: 400 });
    }

    const pyqsDir = path.join(process.cwd(), "knowledge_base", "pyqs");
    const safeSubject = subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const pyqFilePath = path.join(pyqsDir, `${safeSubject}_pyqs.md`);

    // 1. Check if PYQ bank exists for this subject
    if (!fs.existsSync(pyqFilePath)) {
      return NextResponse.json({
        success: false,
        error: `No past papers have been ingested for the subject "${subject}" yet. Please upload a PYQ paper first to extract questions.`,
      }, { status: 404 });
    }

    const pyqContent = fs.readFileSync(pyqFilePath, "utf-8");

    // 2. Load existing study chapters from our vector database
    const chunks = loadVectorDb();
    // Filter chunks by subject
    const subjectChunks = chunks.filter(
      c => c.subject.toLowerCase() === subject.toLowerCase()
    );
    const existingTopics = Array.from(
      new Set(subjectChunks.map(c => `${c.topic}`))
    );

    // 3. Prompt active LLM to cross-reference and build the gap matrix
    const systemPrompt = `You are a curriculum gap analysis specialist.
Your job is to read a subject's compiled Previous Year Questions (PYQs) bank and cross-reference the concepts/questions against the list of "Existing Study Topics" already present in the student's study library.

Evaluate each distilled exam topic:
1. Assess its "importance" / recurrence weight: "High" (frequently tested core concept), "Medium" (occasional appearance), or "Low" (rare, highly specific concept).
2. Compare it with the "Existing Study Topics" list. If the concept is covered in the existing topics, set "coveredInKb" to true. If it is NOT covered (or is a major syllabus gap), set it to false.
3. Supply a brief representative "sampleQuestion" from the paper that tests this topic.

You MUST output strictly a JSON object with this exact schema:
{
  "topics": [
    {
      "name": "Topic Name (e.g. Photoelectric Effect)",
      "importance": "High", // "High" | "Medium" | "Low"
      "sampleQuestion": "Derive Einstein's photoelectric equation...",
      "coveredInKb": false
    }
  ]
}

Ensure you output ONLY the raw JSON object and nothing else. No markdown wraps, no extra text.`;

    const prompt = `Perform a syllabus gap analysis.
Subject: ${subject}

Existing Study Topics in Student's Library:
${existingTopics.length > 0 ? existingTopics.map(t => `- ${t}`).join("\n") : "(None - Student's study library is empty for this subject)"}

Compiled PYQ Bank Questions:
---
${pyqContent.slice(0, 32000)}
---`;

    console.log("Analyzing syllabus gaps...");
    const aiReply = await generateText(config, prompt, systemPrompt, true);

    // Clean potential markdown blocks
    let cleanedReply = aiReply.trim();
    if (cleanedReply.startsWith("```json")) {
      cleanedReply = cleanedReply.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanedReply.startsWith("```")) {
      cleanedReply = cleanedReply.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const payload = JSON.parse(cleanedReply);
    const topics = payload.topics || [];

    return NextResponse.json({
      success: true,
      subject,
      topics,
      totalExtractedTopics: topics.length,
      uncoveredTopicsCount: topics.filter((t: any) => !t.coveredInKb).length,
    });
  } catch (error: any) {
    console.error("PYQ gap analysis failed:", error);
    return NextResponse.json({ success: false, error: error.message || "An unknown error occurred during PYQ analysis." }, { status: 500 });
  }
}
