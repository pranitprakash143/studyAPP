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
import { proxyIngest } from "@/lib/backend-client";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Map frontend field names → backend field names
    // Frontend sends: file, youtubeUrl, pastedText
    // Backend expects: file, youtube_url, pasted_text
    const backendForm = new FormData();

    const subject = (formData.get("subject") as string) || "General";
    const topic = (formData.get("topic") as string) || "Imported Material";
    backendForm.append("subject", subject);
    backendForm.append("topic", topic);

    const file = formData.get("file") as File | null;
    const youtubeUrl = formData.get("youtubeUrl") as string | null;
    const pastedText = formData.get("pastedText") as string | null;

    if (file) {
      backendForm.append("file", file, file.name);
    } else if (youtubeUrl) {
      backendForm.append("youtube_url", youtubeUrl.trim());
    } else if (pastedText) {
      backendForm.append("pasted_text", pastedText.trim());
    } else {
      return NextResponse.json(
        { success: false, error: "No input provided. Upload a file, YouTube link, or paste text." },
        { status: 400 }
      );
    }

    // Forward to FastAPI backend
    const result = await proxyIngest(backendForm);

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
