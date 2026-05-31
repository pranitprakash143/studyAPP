import { NextRequest, NextResponse } from "next/server";
import { loadHighlights, addHighlight, deleteHighlight } from "@/lib/highlights-store";

// ── GET /api/highlights?subject=Name ───────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");

    if (!subject) {
      return NextResponse.json(
        { success: false, error: "Subject is required to retrieve highlights." },
        { status: 400 }
      );
    }

    const allHighlights = loadHighlights();
    const subjectHighlights = allHighlights.filter(
      (h) => h.subject.toLowerCase() === subject.toLowerCase()
    );

    return NextResponse.json({
      success: true,
      highlights: subjectHighlights,
    });
  } catch (error: any) {
    console.error("[Next.js GET /api/highlights]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ── POST /api/highlights ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, subject, topic, text, color, note } = body;

    if (!subject || !text || !color) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (subject, text, color)." },
        { status: 400 }
      );
    }

    const hlId = id || `hl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const saved = addHighlight({
      id: hlId,
      subject,
      topic: topic || "General",
      text,
      color,
      note,
    });

    return NextResponse.json({
      success: true,
      highlight: saved,
    });
  } catch (error: any) {
    console.error("[Next.js POST /api/highlights]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ── DELETE /api/highlights?id=Id ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Highlight ID is required for deletion." },
        { status: 400 }
      );
    }

    const deleted = deleteHighlight(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Highlight not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Highlight deleted successfully.",
    });
  } catch (error: any) {
    console.error("[Next.js DELETE /api/highlights]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
