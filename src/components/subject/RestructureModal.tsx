"use client";

import { X, Loader2 } from "lucide-react";

interface RestructureModalProps {
  isOpen: boolean;
  selectedText: string;
  restructureStyle: string;
  restructureCustom: string;
  generatingRestructure: boolean;
  restructuredText: string;
  onStyleChange: (style: string) => void;
  onCustomChange: (text: string) => void;
  onExecute: () => void;
  onApply: () => void;
  onClose: () => void;
  onDiscard: () => void;
}

export default function RestructureModal({
  isOpen,
  selectedText,
  restructureStyle,
  restructureCustom,
  generatingRestructure,
  restructuredText,
  onStyleChange,
  onCustomChange,
  onExecute,
  onApply,
  onClose,
  onDiscard,
}: RestructureModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-2xl bg-[#0f1422]/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
        <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2 font-sans">
            🪄 AI Restructuring Studio
          </span>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 select-text">
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block font-sans">Original Selection</label>
            <div className="p-4 bg-slate-950/50 border border-slate-850 rounded-xl text-xs leading-relaxed text-slate-400 italic max-h-32 overflow-y-auto font-sans select-all">
              &quot;{selectedText}&quot;
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-indigo-950/10 border border-indigo-950/20 rounded-xl select-none">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block font-sans">Visual Format</label>
              <select
                value={restructureStyle}
                onChange={(e) => onStyleChange(e.target.value)}
                className="w-full text-xs p-2 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 cursor-pointer"
              >
                <option value="bullets">📋 High-Yield Bullet List</option>
                <option value="table">📊 Factual Comparison Table</option>
                <option value="timeline">⏱️ Chronological Flow / Timeline</option>
                <option value="mnemonics">⚡ Revision Mnemonics &amp; Key Facts</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block font-sans">Custom Instructions</label>
              <input
                type="text"
                value={restructureCustom}
                onChange={(e) => onCustomChange(e.target.value)}
                placeholder="e.g., make it sound conversational..."
                className="w-full text-xs p-2 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 placeholder:text-slate-600 font-sans"
              />
            </div>

            <button
              onClick={onExecute}
              disabled={generatingRestructure}
              className="sm:col-span-2 w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold rounded-lg transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed font-sans"
            >
              {generatingRestructure ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Restructuring notes segment...</>
              ) : (
                <>🪄 Execute Note Restructuring</>
              )}
            </button>
          </div>

          {(generatingRestructure || restructuredText) && (
            <div className="space-y-1.5 pt-2 flex flex-col min-h-[180px]">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block font-sans">Restructured AI Output Preview</label>
              <div className="flex-1 p-4 bg-slate-950 border border-slate-850 rounded-xl text-xs leading-relaxed text-slate-350 overflow-y-auto max-h-60 select-text font-sans scrollbar-thin">
                {generatingRestructure ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500 select-none">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                    <span>AI is restructuring note elements...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {restructuredText.split("\n\n").map((p, idx) => {
                      if (p.startsWith("|")) {
                        return (
                          <div key={idx} className="overflow-x-auto my-2 border border-slate-850 rounded-lg">
                            <table className="w-full text-left text-[11px] leading-relaxed">
                              <tbody>
                                {p.split("\n").map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b border-slate-900 hover:bg-slate-900/40">
                                    {row.split("|").slice(1, -1).map((cell, cIdx) => (
                                      <td key={cIdx} className="p-2 font-medium">{cell.trim()}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }
                      if (p.startsWith("#") || p.startsWith("##") || p.startsWith("###")) {
                        return <h4 key={idx} className="font-bold text-indigo-400 mt-2 text-xs">{p.replace(/#/g, "")}</h4>;
                      }
                      if (p.startsWith("-") || p.startsWith("*")) {
                        return (
                          <ul key={idx} className="list-disc pl-5 space-y-1 text-xs">
                            {p.split("\n").map((item, iIdx) => (
                              <li key={iIdx}>{item.replace(/^[-*]\s+/, "")}</li>
                            ))}
                          </ul>
                        );
                      }
                      return <p key={idx} className="leading-relaxed text-justify">{p}</p>;
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {restructuredText && !generatingRestructure && (
          <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex gap-3 shrink-0 select-none">
            <button
              onClick={onDiscard}
              className="flex-1 py-2 border border-slate-700 text-slate-350 hover:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer transition text-center font-sans"
            >
              Discard Changes
            </button>
            <button
              onClick={onApply}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-md flex items-center justify-center gap-1.5 text-center font-sans"
            >
              Accept &amp; Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
