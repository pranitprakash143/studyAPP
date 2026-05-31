/**
 * POST /api/ingest
 *
 * Thin proxy: receives the FormData from the upload page and forwards it
 * directly to the Python FastAPI backend, which handles:
 *  - PDF / DOCX / PPTX / image / YouTube / pasted-text parsing
 *  - LangGraph 9-node pipeline: analyze → clean → split → TOC → tag → assemble → format → save → mindmap
 *  - ChromaDB upsert at subtopic level (idempotent via content hash)
 *
 * Response is mapped to the shape the frontend already expects:
 *  { success, subject, topic, source, sections, sectionsAdded, completenessScore }
 */
import { NextRequest, NextResponse } from "next/server";
import { proxyIngest, IngestRequest } from "@/lib/backend-client";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const subject = (formData.get("subject") as string) || "General";
    const topic = (formData.get("topic") as string) || "Imported Material";
    const file = formData.get("file") as File | null;
    const youtubeUrl = formData.get("youtubeUrl") as string | null;
    const pastedText = formData.get("pastedText") as string | null;

    if (!file && !youtubeUrl && !pastedText) {
      return NextResponse.json(
        { success: false, error: "No input provided. Upload a file, YouTube link, or paste text." },
        { status: 400 }
      );
    }

    const ingestRequest: IngestRequest = {
      subject,
      topic,
      file,
      youtubeUrl,
      pastedText,
    };

    // Forward to FastAPI backend via typed client
    const result = await proxyIngest(ingestRequest);

    // If backend returned a background job ID (status 202)
    if (result.status === "processing" && result.job_id) {
      return NextResponse.json({
        success: true,
        status: "processing",
        jobId: result.job_id,
        message: result.message,
        subject: result.subject,
        topic: result.topic,
        source: result.source,
      }, { status: 202 });
    }

    // Fallback if backend returned synchronous result (e.g. tests)
    return NextResponse.json({
      success: true,
      subject: result.subject,
      topic: result.topic,
      source: result.source,
      sections: (result.chapters || []).map((c: any) => ({
        title: c.title,
        content: c.preview || c.content || "",
      })),
      sectionsAdded: result.chunks_added,
      completenessScore: result.completeness_score,
      mindmapAdded: !!result.mindmap,
      pipelineErrors: result.warnings || [],
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "An unknown error occurred during ingestion.";
    console.error("[Next.js /api/ingest] Proxy failed:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
