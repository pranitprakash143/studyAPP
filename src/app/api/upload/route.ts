import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const allowed = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
    if (!allowed.includes(ext)) {
      return NextResponse.json({ success: false, error: "File type not allowed." }, { status: 400 });
    }

    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filepath = path.join(uploadDir, name);
    await writeFile(filepath, buffer);

    return NextResponse.json({ success: true, url: `/uploads/${name}` });
  } catch (error: any) {
    console.error("[Next.js POST /api/upload]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
