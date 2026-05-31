import fs from "fs";
import path from "path";

// Define log paths - logs are saved inside the shared knowledge_base directory
const LOGS_DIR = path.join(process.cwd(), "knowledge_base", "logs");
const LOG_FILE = path.join(LOGS_DIR, "nextjs.log");

// Thread-safe append lock or safeguard
let isAppending = false;

// Ensure directories exist
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
} catch (e) {
  // Silent fallback - don't crash the server if logging dir can't be created
}

/**
 * Cleanly write or append log line to nextjs.log
 * Limits log file size to 10MB to avoid OOM or filled disk in production
 */
function appendLog(level: string, message: string) {
  if (isAppending) return; // Prevent recursive loop if console calls happen inside
  isAppending = true;

  try {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    // Limit log file to 10MB to prevent run-away storage usage
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > 10 * 1024 * 1024) {
        // Clear log file if it exceeds size
        fs.writeFileSync(LOG_FILE, `[${timestamp}] [SYSTEM] Log file capped and restarted due to size exceeding 10MB.\n`, "utf8");
      }
    }

    fs.appendFileSync(LOG_FILE, formatted, "utf8");
  } catch (err) {
    // Fail silently in case of FS errors to keep server running
  } finally {
    isAppending = false;
  }
}

// Global server-side interception (only if running inside Node.js environment)
if (typeof window === "undefined" && !(global as any).__logger_registered) {
  (global as any).__logger_registered = true;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  const formatArgs = (args: any[]): string => {
    return args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.stack || arg.message;
        }
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (_) {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");
  };

  console.log = (...args) => {
    originalLog(...args);
    appendLog("INFO", formatArgs(args));
  };

  console.info = (...args) => {
    originalInfo(...args);
    appendLog("INFO", formatArgs(args));
  };

  console.warn = (...args) => {
    originalWarn(...args);
    appendLog("WARN", formatArgs(args));
  };

  console.error = (...args) => {
    originalError(...args);
    appendLog("ERROR", formatArgs(args));
  };

  // Log initial bootstrap
  appendLog("SYSTEM", "Next.js Console Logger successfully registered server-side.");
}
