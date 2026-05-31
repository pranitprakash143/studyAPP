import "@/lib/logger"; // Ensure console logger is active
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LOGS_DIR = path.join(process.cwd(), "knowledge_base", "logs");
const NEXTJS_LOG_FILE = path.join(LOGS_DIR, "nextjs.log");
const BACKEND_LOG_FILE = path.join(LOGS_DIR, "backend.log");

// Helper to read the last N lines of a file
function readLastNLines(filePath: string, n: number = 500): string {
  try {
    if (!fs.existsSync(filePath)) {
      return `[SYSTEM] Log file not found at ${filePath}. It will be created when logs are generated.`;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    if (lines.length <= n) {
      return content;
    }
    
    return lines.slice(-n).join("\n");
  } catch (err: any) {
    return `[ERROR] Failed to read log file: ${err.message}`;
  }
}

/**
 * GET /api/admin/logs
 * Retrieves the last 500 lines of nextjs.log and backend.log
 */
export async function GET(req: NextRequest) {
  try {
    const nextjsLogs = readLastNLines(NEXTJS_LOG_FILE, 500);
    const backendLogs = readLastNLines(BACKEND_LOG_FILE, 500);

    return NextResponse.json({
      success: true,
      nextjs: nextjsLogs,
      backend: backendLogs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load logs." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/logs/clear
 * Clears/Truncates both log files
 */
export async function POST(req: NextRequest) {
  try {
    const timestamp = new Date().toISOString();
    const clearMessage = `[${timestamp}] [SYSTEM] Logs cleared by administrator.\n`;

    // Ensure log directory exists before writing
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }

    fs.writeFileSync(NEXTJS_LOG_FILE, clearMessage, "utf8");
    fs.writeFileSync(BACKEND_LOG_FILE, clearMessage, "utf8");

    console.log("[SYSTEM] Server logs cleared via admin portal.");

    return NextResponse.json({
      success: true,
      message: "Logs successfully cleared.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to clear logs." },
      { status: 500 }
    );
  }
}
