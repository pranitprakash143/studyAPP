import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/subjects`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to fetch subjects");

    const ca = data.subjects?.find(
      (s: any) => s.subject === "Current Affairs"
    );
    const topics: string[] = ca?.topics || [];

    return NextResponse.json({ success: true, topics });
  } catch (error: any) {
    console.error("[current-affairs/history] GET failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load history." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic } = body;

    if (!topic) {
      return NextResponse.json(
        { success: false, error: "Topic (date) is required." },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${BACKEND_URL}/api/subject/Current%20Affairs`
    );
    const data = await res.json();
    if (!res.ok)
      return NextResponse.json(
        { success: false, error: data.detail || "Subject not found." },
        { status: 404 }
      );

    const markdown: string = data.markdown || "";

    // Extract the section for the requested topic/date
    const sectionRegex = new RegExp(
      `## ${topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s\\S]*?)(?=\\n## |\\n---|$)`,
      "i"
    );
    const match = markdown.match(sectionRegex);
    const content = match ? match[0].trim() : "";

    return NextResponse.json({ success: true, content, topic });
  } catch (error: any) {
    console.error("[current-affairs/history] POST failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load digest." },
      { status: 500 }
    );
  }
}
