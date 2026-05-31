import { NextRequest, NextResponse } from "next/server";
import { appendMindmap } from "@/lib/mindmap-store";

// Use the same backend URL resolution logic as backend-client.ts
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const { subject, topic, content } = await req.json();

    if (!subject || !topic) {
      return NextResponse.json({ success: false, error: "Subject and topic are required." }, { status: 400 });
    }

    // Call the Python FastAPI backend to generate the mindmap
    const url = `${BACKEND_URL}/api/wiki/${encodeURIComponent(subject)}/${encodeURIComponent(topic)}/mindmap`;
    
    console.log(`[Next.js API] Calling backend for mindmap generation: ${url}`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Backend mindmap generation failed: ${response.status}`, errText);
      return NextResponse.json({ success: false, error: "Backend failed to generate mindmap." }, { status: response.status });
    }

    const data = await response.json();
    
    if (!data.mindmap || !data.mindmap.nodes) {
      return NextResponse.json({ success: false, error: "Backend returned invalid mindmap data." }, { status: 500 });
    }

    // Save the newly generated mindmap to our local store
    appendMindmap(subject, topic, data.mindmap.nodes, data.mindmap.edges || []);

    return NextResponse.json({ success: true, mindmap: data.mindmap });
  } catch (error: any) {
    console.error("[Next.js API] /api/mindmaps/generate failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
