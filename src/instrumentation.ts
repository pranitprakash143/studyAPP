/**
 * Next.js Instrumentation Hook
 * Runs once upon Next.js server initialization.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamically load the global console logging hijack
    await import("./lib/logger");
  }
}
