/**
 * GET /api/library
 * POST /api/library
 *
 * GET  → Lists all subjects from ChromaDB via FastAPI + local PYQ markdown files
 * POST → Keyword search across ChromaDB chunks via FastAPI + PYQ files locally
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { listSubjects, queryKnowledgeBase } from "@/lib/backend-client";

const PYQ_DIR = path.join(process.cwd(), "knowledge_base", "pyqs");

// ── GET /api/library ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // 1. Study notes catalog from ChromaDB (via FastAPI)
    const subjects = await listSubjects();

    const studyNotes = subjects.map((s) => ({
      subject: s.subject,
      topicCount: s.topic_count,
      chunkCount: s.topic_count, // approximate
      sources: s.topics,
      topics: s.topics,
    }));

    // 2. PYQ banks from local filesystem (unchanged — PYQs still local)
    const pyqBanks: object[] = [];
    if (fs.existsSync(PYQ_DIR)) {
      const files = fs.readdirSync(PYQ_DIR).filter((f) => f.endsWith(".md"));
      files.forEach((file) => {
        const filePath = path.join(PYQ_DIR, file);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, "utf-8");

        let subject = file.replace(/_pyqs\.md$/, "").replace(/_/g, " ");
        subject = subject.replace(/\b\w/g, (c) => c.toUpperCase());

        const questionCount = (content.match(/### Question/g) || []).length;
        const paperCount = (content.match(/## Exam Paper:/g) || []).length;

        pyqBanks.push({
          fileName: file,
          subject,
          paperCount,
          questionCount,
          sizeBytes: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          contentPreview: content.slice(0, 1000),
        });
      });
    }

    return NextResponse.json({ success: true, studyNotes, pyqBanks });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Library load failed.";
    console.error("[Next.js GET /api/library]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── POST /api/library — keyword search ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query?.trim()) {
      return NextResponse.json(
        { success: false, error: "Query is required for search." },
        { status: 400 }
      );
    }

    const searchTerm = query.trim().toLowerCase();

    // 1. Semantic search via FastAPI (much better than keyword matching)
    const results = await queryKnowledgeBase(query, undefined, 20);

    const noteHits = results.map((r) => ({
      id: r.chunk_id,
      subject: r.subject,
      topic: r.topic,
      source: r.source,
      snippet: r.content.slice(0, 200) + (r.content.length > 200 ? "..." : ""),
      timestamp: new Date().toISOString(),
    }));

    // 2. Keyword search across local PYQ files (unchanged)
    const pyqHits: object[] = [];
    if (fs.existsSync(PYQ_DIR)) {
      const files = fs.readdirSync(PYQ_DIR).filter((f) => f.endsWith(".md"));
      files.forEach((file) => {
        const filePath = path.join(PYQ_DIR, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const contentLower = content.toLowerCase();

        if (contentLower.includes(searchTerm)) {
          let subject = file.replace(/_pyqs\.md$/, "").replace(/_/g, " ");
          subject = subject.replace(/\b\w/g, (c) => c.toUpperCase());

          const snippets: string[] = [];
          let lastIndex = 0;
          for (let i = 0; i < 3; i++) {
            const idx = contentLower.indexOf(searchTerm, lastIndex);
            if (idx === -1) break;
            const start = Math.max(0, idx - 60);
            const end = Math.min(content.length, idx + searchTerm.length + 80);
            snippets.push(
              (start > 0 ? "..." : "") +
                content.slice(start, end).replace(/\n+/g, " ") +
                (end < content.length ? "..." : "")
            );
            lastIndex = idx + searchTerm.length + 1;
          }

          pyqHits.push({
            fileName: file,
            subject,
            snippets,
            sizeBytes: fs.statSync(filePath).size,
          });
        }
      });
    }

    return NextResponse.json({ success: true, query: query.trim(), noteHits, pyqHits });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Library search failed.";
    console.error("[Next.js POST /api/library]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
