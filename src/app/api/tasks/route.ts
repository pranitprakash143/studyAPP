import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const url = status
      ? `${BACKEND_URL}/api/tasks?status=${encodeURIComponent(status)}`
      : `${BACKEND_URL}/api/tasks`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend error: ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to reach backend", tasks: [] },
      { status: 200 }
    );
  }
}
