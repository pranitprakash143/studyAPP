"use client";

import { X } from "lucide-react";

type HighlightColor = "yellow" | "green" | "pink" | "blue";

interface SelectionHudProps {
  visible: boolean;
  selectedText: string;
  onHighlight: (color: HighlightColor) => void;
  onAnnotate: () => void;
  onExplain: () => void;
  onRestructure: () => void;
  onClear: () => void;
}

export default function SelectionHud({
  visible,
  selectedText,
  onHighlight,
  onAnnotate,
  onExplain,
  onRestructure,
  onClear,
}: SelectionHudProps) {
  if (!visible) return null;

  return (
    <div 
      className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 p-2 bg-slate-900/90 dark:bg-slate-950/90 text-white rounded-full border border-slate-700/80 dark:border-slate-800/80 shadow-2xl backdrop-blur-lg select-none animate-fade-in pr-3 pl-3"
    >
      <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-700 max-w-[120px] sm:max-w-[200px] select-text">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
          &quot;{selectedText}&quot;
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-2 border-r border-slate-700 select-none">
        <button 
          onClick={() => onHighlight("yellow")}
          className="w-4 h-4 rounded-full bg-amber-400 hover:scale-110 active:scale-95 transition cursor-pointer"
          title="Highlight Yellow"
        />
        <button 
          onClick={() => onHighlight("green")}
          className="w-4 h-4 rounded-full bg-emerald-400 hover:scale-110 active:scale-95 transition cursor-pointer"
          title="Highlight Green"
        />
        <button 
          onClick={() => onHighlight("pink")}
          className="w-4 h-4 rounded-full bg-pink-400 hover:scale-110 active:scale-95 transition cursor-pointer"
          title="Highlight Pink"
        />
        <button 
          onClick={() => onHighlight("blue")}
          className="w-4 h-4 rounded-full bg-sky-400 hover:scale-110 active:scale-95 transition cursor-pointer"
          title="Highlight Blue"
        />
      </div>

      <button 
        onClick={onAnnotate}
        className="px-2.5 py-1 hover:bg-slate-800 rounded-full text-[11px] font-bold flex items-center gap-1 text-slate-300 hover:text-white transition cursor-pointer"
        title="Add sticky comment"
      >
        📝 <span className="hidden sm:inline">Comment</span>
      </button>

      <button 
        onClick={onExplain}
        className="px-2.5 py-1 hover:bg-slate-800 rounded-full text-[11px] font-bold flex items-center gap-1 text-indigo-300 hover:text-indigo-200 transition cursor-pointer"
        title="Ask Socratic AI to explain this selection"
      >
        💬 <span className="hidden sm:inline">Explain</span>
      </button>

      <button 
        onClick={onRestructure}
        className="px-2.5 py-1 hover:bg-slate-800 rounded-full text-[11px] font-bold flex items-center gap-1 text-amber-300 hover:text-amber-200 transition cursor-pointer"
        title="Use AI to restructure selection"
      >
        🪄 <span className="hidden sm:inline">Restructure</span>
      </button>

      <button 
        onClick={onClear}
        className="p-1 hover:bg-rose-500/20 hover:text-rose-400 rounded-full text-slate-400 transition cursor-pointer ml-0.5"
        title="Clear Selection"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
