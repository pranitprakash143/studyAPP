"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";

function parseAIErrors(errString: string): { mainMessage: string; details?: string } {
  if (!errString) return { mainMessage: "An unexpected error occurred" };
  const jsonStartIdx = errString.indexOf("{");
  if (jsonStartIdx !== -1) {
    try {
      const jsonStr = errString.substring(jsonStartIdx);
      const parsed = JSON.parse(jsonStr);
      const innerMessage = parsed.error?.message || parsed.message || parsed.detail || parsed.error || null;
      if (innerMessage) {
        return {
          mainMessage: errString.substring(0, jsonStartIdx).replace(/:\s*$/, "") + ": " + innerMessage,
          details: JSON.stringify(parsed, null, 2)
        };
      }
    } catch (e) {}
  }
  return { mainMessage: errString };
}

interface NotificationBannersProps {
  saveSuccess: boolean;
  errorMessage: string;
  onDismissError: () => void;
}

export default function NotificationBanners({
  saveSuccess,
  errorMessage,
  onDismissError,
}: NotificationBannersProps) {
  return (
    <>
      {saveSuccess && (
        <div className="bg-emerald-500 text-white px-6 py-2 flex items-center gap-2 justify-center font-medium text-xs shrink-0">
          <CheckCircle2 className="h-4 w-4" /> Notes saved and indexed successfully.
        </div>
      )}
      {errorMessage && (() => {
        const parsed = parseAIErrors(errorMessage);
        return (
          <div className="bg-rose-500/90 dark:bg-rose-950/90 backdrop-blur text-white px-6 py-2.5 flex flex-col md:flex-row items-center gap-3 justify-between font-medium text-xs shrink-0 border-b border-rose-600/30 shadow-md transition-all duration-300 animate-slide-in relative z-50">
            <div className="flex items-start gap-2 flex-1 w-full">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-200" />
              <div className="flex-1">
                <span className="font-semibold text-rose-100">Error: </span>
                <span>{parsed.mainMessage}</span>
                {parsed.details && (
                  <details className="mt-1 text-[10px] text-rose-200 bg-black/20 p-2 rounded cursor-pointer select-text">
                    <summary className="font-semibold hover:text-white transition-colors">Show developer details</summary>
                    <pre className="mt-1 font-mono overflow-auto max-h-40">{parsed.details}</pre>
                  </details>
                )}
              </div>
            </div>
            <button 
              type="button"
              onClick={onDismissError}
              className="text-rose-200 hover:text-white font-bold px-2 py-1 rounded hover:bg-white/10 transition cursor-pointer self-start md:self-center"
            >
              Dismiss
            </button>
          </div>
        );
      })()}
    </>
  );
}
