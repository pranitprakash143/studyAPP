import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const res = await fetch(`${BACKEND_URL}/api/tasks/${taskId}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: `Backend error: ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to reach backend" },
      { status: 503 }
    );
  }
}
