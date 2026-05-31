/**
 * src/app/api/wiki/route.ts
 *
 * Next.js API route — proxies wiki requests to the FastAPI backend.
 * Handles:
 *   GET /api/wiki           → list all wiki pages
 *   GET /api/wiki/graph     → knowledge graph nodes + edges for visualization
 *   GET /api/wiki/:subject/:slug → single wiki page content
 */

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

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/wiki`, {
      cache: "no-store",
    });

    if (!res.ok) {
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
