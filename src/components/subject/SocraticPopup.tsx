"use client";

import { X, Loader2 } from "lucide-react";

interface SocraticPopupProps {
  isOpen: boolean;
  isLoading: boolean;
  answer: string;
  questionText: string;
  position: { top: number; left: number } | null;
  onClose: () => void;
}

export default function SocraticPopup({
  isOpen,
  isLoading,
  answer,
  questionText,
  position,
  onClose,
}: SocraticPopupProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute z-50 flex flex-col gap-3 p-4 bg-slate-900/95 dark:bg-slate-950/95 border border-indigo-500/35 rounded-xl shadow-2xl backdrop-blur-md -translate-x-1/2 w-[340px] animate-fade-in"
      style={{ 
        top: `${position ? position.top + 45 : 100}px`, 
        left: `${position ? position.left : 100}px`,
      }}
    >
      <div className="flex items-center justify-between border-b border-slate-850 pb-1.5 select-none">
        <span className="text-xs font-extrabold text-indigo-400 flex items-center gap-1 font-sans uppercase tracking-wider">
          🎓 Socratic Quick Explain
        </span>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-60 overflow-y-auto text-xs text-slate-200 font-sans leading-relaxed select-text pr-1.5 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-400 select-none">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <span className="text-[10px]">Asking Socratic AI to analyze...</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] text-slate-500 italic mb-2 border-l border-slate-700 pl-2 select-none">
              &quot;{questionText.substring(0, 80)}...&quot;
            </div>
            <div className="markdown-socratic space-y-3">
              {answer.split("\n\n").map((para, pIdx) => {
                if (para.startsWith("###") || para.startsWith("##") || para.startsWith("💡") || para.startsWith("🔍") || para.startsWith("🙋")) {
                  return <h4 key={pIdx} className="font-bold text-indigo-300 mt-2 text-xs select-none">{para}</h4>;
                }
                if (para.startsWith("-") || para.startsWith("*")) {
                  return (
                    <ul key={pIdx} className="list-disc pl-4 space-y-1 my-1">
                      {para.split("\n").map((line, lIdx) => (
                        <li key={lIdx}>{line.replace(/^[-*]\s+/, "")}</li>
                      ))}
                    </ul>
                  );
                }
                return <p key={pIdx} className="text-slate-300 leading-relaxed text-justify">{para}</p>;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
