import { NextRequest, NextResponse } from "next/server";
import fs from "fs";

const _rawBackendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

const _isInsideDocker = fs.existsSync("/.dockerenv");

const BACKEND_URL =
  !_isInsideDocker && _rawBackendUrl.includes("//backend")
    ? _rawBackendUrl.replace("//backend", "//localhost")
    : _rawBackendUrl;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const res = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      const error = await res.text();
      return NextResponse.json(
        { error: `Backend error: ${res.status}`, detail: error },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to reach backend", detail: err.message },
      { status: 503 }
    );
  }
}
