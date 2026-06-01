"use client";

import { X, Loader2 } from "lucide-react";

interface RestructureContext {
  targetChapter?: string;
}

interface SandboxCompareModalProps {
  isOpen: boolean;
  isCleaningChapter: boolean;
  subject: string;
  restructureContext: RestructureContext | null;
  originalTextBackup: string;
  restructurePreviewText: string;
  onClose: () => void;
  onApply: () => void;
  onDiscard: () => void;
}

export default function SandboxCompareModal({
  isOpen,
  isCleaningChapter,
  subject,
  restructureContext,
  originalTextBackup,
  restructurePreviewText,
  onClose,
  onApply,
  onDiscard,
}: SandboxCompareModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="w-full max-w-6xl h-[88vh] bg-[#0c101c]/98 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20 text-sm">📖</span>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-sans">Chapter Restructuring Sandbox</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-sans">Refining: &quot;{restructureContext?.targetChapter}&quot; in {subject}</p>
            </div>
          </div>
          
          {!isCleaningChapter && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 bg-slate-950/20 select-text">
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-900/40 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">Original Source Notes</span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full shrink-0 font-sans">
                {originalTextBackup ? `${originalTextBackup.length.toLocaleString()} chars` : "0 chars"}
              </span>
            </div>
            <div className="flex-1 p-6 overflow-y-auto font-sans leading-relaxed text-slate-350 text-xs whitespace-pre-wrap select-all selection:bg-slate-800 select-text">
              {originalTextBackup || "Loading original chapter..."}
            </div>
          </div>

          <div className="flex flex-col h-full overflow-hidden bg-indigo-950/[0.02]">
            <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-900/40 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest font-sans flex items-center gap-1.5 animate-pulse">
                ✨ Refined AI Preview
              </span>
              <div className="flex items-center gap-2">
                {isCleaningChapter && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0 animate-pulse font-sans">
                    ⚡ Streaming...
                  </span>
                )}
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full shrink-0 font-sans">
                  {restructurePreviewText ? `${restructurePreviewText.length.toLocaleString()} chars` : "0 chars"}
                </span>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto font-sans leading-relaxed text-slate-200 text-xs select-text">
              {!restructurePreviewText && isCleaningChapter ? (
                <div className="flex flex-col items-center justify-center h-full space-y-3 shrink-0">
                  <Loader2 className="h-6 w-6 text-indigo-500 animate-spin shrink-0" />
                  <span className="text-xs text-slate-500 font-sans animate-pulse">AI is parsing and restructuring...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {restructurePreviewText.split("\n\n").map((p, idx) => {
                    if (p.startsWith("### ")) {
                      return (
                        <h3 key={idx} className="font-sans font-bold text-sm text-slate-100 border-b border-slate-800 pb-1 mt-4">
                          {p.replace("### ", "")}
                        </h3>
                      );
                    }
                    if (p.startsWith("|") || p.startsWith("┌")) {
                      return (
                        <div key={idx} className="overflow-x-auto my-3 p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                          <pre className="text-[10px] font-mono text-indigo-300 leading-normal whitespace-pre">
                            {p}
                          </pre>
                        </div>
                      );
                    }
                    if (p.startsWith("-") || p.startsWith("*") || p.startsWith("•")) {
                      return (
                        <ul key={idx} className="list-disc pl-5 space-y-1.5 text-xs text-slate-350">
                          {p.split("\n").map((item, iIdx) => (
                            <li key={iIdx}>{item.replace(/^[-*•]\s+/, "")}</li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={idx} className="leading-relaxed text-justify text-slate-300 select-text">{p}</p>;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0 select-none">
          <div className="text-[10px] text-slate-500 font-sans max-w-sm hidden sm:block">
            Original H2 heading and source parameters are shielded programmatically to ensure link and TOC integrity.
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              disabled={isCleaningChapter}
              onClick={onDiscard}
              className="px-5 py-2 border border-slate-700 text-slate-350 hover:text-white text-xs font-bold rounded-lg transition shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 font-sans"
            >
              Discard Changes
            </button>
            <button
              disabled={isCleaningChapter || !restructurePreviewText}
              onClick={onApply}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-850 disabled:text-slate-550 text-white text-xs font-bold rounded-lg transition shrink-0 shadow-md cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 font-sans"
            >
              {isCleaningChapter ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> Refining...</>
              ) : (
                <>Accept &amp; Apply Clean</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
