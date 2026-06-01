import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, topic } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one news item is required." },
        { status: 400 }
      );
    }

    const res = await fetch(`${BACKEND_URL}/api/current-affairs/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, topic }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data.detail || "Save failed." },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("[current-affairs/save] Proxy failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save current affairs." },
      { status: 500 }
    );
  }
}
