import { NextRequest, NextResponse } from "next/server";
import { loadMindmaps } from "@/lib/mindmap-store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");
    const topic = searchParams.get("topic");

    const graphs = loadMindmaps();

    if (subject && topic) {
      const match = graphs.find(g => g.subject === subject && g.topic === topic);
      return NextResponse.json({ success: true, graph: match || null });
    } else if (subject) {
      const matches = graphs.filter(g => g.subject === subject);
      return NextResponse.json({ success: true, graphs: matches });
    }

    return NextResponse.json({ success: true, graphs });
  } catch (error: any) {
    console.error("Failed to fetch mindmaps:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
