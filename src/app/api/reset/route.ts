import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const KNOWLEDGE_BASE = path.join(process.cwd(), "knowledge_base");
const LOGS_DIR = path.join(KNOWLEDGE_BASE, "logs");

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

async function callBackendReset(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/reset`, { method: "POST" });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

function resetLocalFiles(): void {
  const paths = [
    path.join(KNOWLEDGE_BASE, "master_kb.md"),
    path.join(KNOWLEDGE_BASE, "metadata", "vector_db.json"),
    path.join(KNOWLEDGE_BASE, "metadata", "highlights.json"),
    path.join(KNOWLEDGE_BASE, "metadata", "mindmaps.json"),
  ];
  for (const p of paths) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(p);
    fs.writeFileSync(p, ext === ".md" ? "" : ext === ".json" ? (p.endsWith("vector_db.json") ? "{}" : "[]") : "", "utf8");
  }
}

function clearWiki(): void {
  const wikiDir = path.join(KNOWLEDGE_BASE, "wiki");
  if (!fs.existsSync(wikiDir)) return;
  for (const entry of fs.readdirSync(wikiDir, { withFileTypes: true })) {
    const full = path.join(wikiDir, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(full, { recursive: true, force: true });
    } else {
      fs.unlinkSync(full);
    }
  }
}

function clearLogs(): void {
  if (!fs.existsSync(LOGS_DIR)) return;
  for (const file of ["backend.log", "nextjs.log"]) {
    const p = path.join(LOGS_DIR, file);
    if (fs.existsSync(p)) fs.writeFileSync(p, `[${new Date().toISOString()}] [SYSTEM] Logs cleared by reset.\n`, "utf8");
  }
}

export async function POST(_req: NextRequest) {
  try {
    const backendOk = await callBackendReset();

    resetLocalFiles();
    clearWiki();
    clearLogs();

    return NextResponse.json({
      success: true,
      message: "All databases and knowledge base data cleared.",
      backend_reset: backendOk,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Reset failed." },
      { status: 500 }
    );
  }
}
