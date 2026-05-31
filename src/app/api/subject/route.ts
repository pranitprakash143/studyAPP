/**
 * /api/subject — GET, POST, DELETE
 *
 * GET    → Fetches subject chunks from ChromaDB (via FastAPI) and compiles markdown
 * POST   → Re-ingests edited markdown as pasted text back to FastAPI
 * DELETE → Deletes subject or topic from ChromaDB via FastAPI
 */
import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest } from "@/lib/ai-provider";
import { getSubjectChunks, deleteSubject, proxyIngest, saveSubjectNotesDirectly } from "@/lib/backend-client";

// ── GET /api/subject?subject=Name ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");

    if (!subject) {
      return NextResponse.json(
        { success: false, error: "Subject parameter is required." },
        { status: 400 }
      );
    }

    const data = await getSubjectChunks(subject);

    if (data.topic_count === 0) {
      return NextResponse.json({
        success: true,
        markdown: `# Subject: ${subject}\n\n*No ingested notes found for this subject yet. Start by adding a topic!*`,
        topics: [],
        sources: [],
      });
    }

    // Compile all chunks into a structured Markdown document
    let markdown = `# Subject: ${subject}\n\n`;
    const topicsList: { name: string; sources: string[] }[] = [];
    const allSources = new Set<string>();

    for (const [topicName, chunks] of Object.entries(data.topics)) {
      const sources = Array.from(new Set(chunks.map((c) => c.source)));
      sources.forEach((s) => allSources.add(s));
      topicsList.push({ name: topicName, sources });

      markdown += `## Topic: ${topicName}\n`;
      markdown += `* **Sources**: ${sources.join(", ")}\n\n`;
      chunks.forEach((chunk) => {
        markdown += `${chunk.content}\n\n`;
      });
      markdown += `---\n\n`;
    }

    return NextResponse.json({
      success: true,
      subject,
      markdown: markdown.trim(),
      topics: topicsList,
      sources: Array.from(allSources),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load subject.";
    console.error("[Next.js GET /api/subject]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── POST /api/subject — save edited notes directly to ChromaDB without ingestion pipeline ──────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject, markdown } = body;

    if (!subject) {
      return NextResponse.json(
        { success: false, error: "Subject is required to save notes." },
        { status: 400 }
      );
    }
    if (markdown === undefined) {
      return NextResponse.json(
        { success: false, error: "Markdown content is required." },
        { status: 400 }
      );
    }

    // Parse markdown into individual topic chapters
    const chapters: { title: string; content: string }[] = [];
    const lines = markdown.split("\n");
    let currentTitle = "";
    let currentContentLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("## ")) {
        // Save previous chapter if it exists
        if (currentTitle && currentContentLines.length > 0) {
          const cleanContent = currentContentLines
            .filter((l) => !l.trim().startsWith("* **Sources**:") && l.trim() !== "---")
            .join("\n")
            .trim();
          if (cleanContent) {
            chapters.push({ title: currentTitle, content: cleanContent });
          }
        }

        // Extract new title
        const headerText = line.substring(3).trim();
        currentTitle = headerText.startsWith("Topic:") ? headerText.substring(6).trim() : headerText;
        currentContentLines = [];
      } else {
        // Collect content
        currentContentLines.push(line);
      }
    }

    // Save final chapter
    if (currentTitle && currentContentLines.length > 0) {
      const cleanContent = currentContentLines
        .filter((l) => !l.trim().startsWith("* **Sources**:") && l.trim() !== "---")
        .join("\n")
        .trim();
      if (cleanContent) {
        chapters.push({ title: currentTitle, content: cleanContent });
      }
    }

    // Call direct upsert API on backend
    const result = await saveSubjectNotesDirectly(subject, chapters);

    return NextResponse.json({
      success: true,
      subject,
      totalChunks: result.chunks_added,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save subject notes.";
    console.error("[Next.js POST /api/subject]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── DELETE /api/subject?subject=Name&topic=Name ───────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");
    const topic = searchParams.get("topic") || undefined;

    if (!subject) {
      return NextResponse.json(
        { success: false, error: "Subject is required." },
        { status: 400 }
      );
    }

    const result = await deleteSubject(subject, topic);

    return NextResponse.json({
      success: true,
      message: topic
        ? `Topic '${topic}' deleted successfully.`
        : `Subject '${subject}' deleted successfully.`,
      deleted: result.deleted,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete notes.";
    console.error("[Next.js DELETE /api/subject]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
