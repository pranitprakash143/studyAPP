"use client";

import { Wand2, Network, MessageSquare, Sparkles, Loader2, X } from "lucide-react";
import type { TopicNode } from "@/lib/subject/types";

type CleanStyle = "bullets" | "summary" | "table" | "timeline";

interface AiAssistantPanelProps {
  collapsed: boolean;
  onClose: () => void;
  selectedChapterName: string;
  onSelectedChapterChange: (name: string) => void;
  onActiveChapterFilterChange: (filter: string) => void;
  cleanStyle: CleanStyle;
  onCleanStyleChange: (style: CleanStyle) => void;
  isCleaningChapter: boolean;
  onCleanChapter: (chapterName: string) => void;
  topics: TopicNode[];
  onGenerateMindmap: () => void;
}

export default function AiAssistantPanel({
  collapsed,
  onClose,
  selectedChapterName,
  onSelectedChapterChange,
  onActiveChapterFilterChange,
  cleanStyle,
  onCleanStyleChange,
  isCleaningChapter,
  onCleanChapter,
  topics,
  onGenerateMindmap,
}: AiAssistantPanelProps) {
  return (
    <aside className={`bg-white dark:bg-[#111726] border-l border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 shrink-0 select-none relative z-10 ${collapsed ? "w-0 overflow-hidden opacity-0 border-l-0" : "w-72 opacity-100"}`}>
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#111726]/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-[13px] font-bold text-slate-800 dark:text-slate-200">AI Assistant</h3>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 w-72">
        
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5 text-indigo-500" />
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Chapter Cleaner</h4>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Select a chapter and an output style. AI will intelligently format the content while preserving zero factual loss.
          </p>
          
          <div className="flex flex-col gap-2">
            <select
              value={selectedChapterName || ""}
              onChange={(e) => {
                onSelectedChapterChange(e.target.value);
                onActiveChapterFilterChange(e.target.value);
              }}
              className="w-full text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="" disabled>Select chapter...</option>
              {topics.map((t, i) => (
                <option key={`${t.name}-${i}`} value={t.name}>{t.name}</option>
              ))}
            </select>

            <select
              value={cleanStyle}
              onChange={(e) => onCleanStyleChange(e.target.value as CleanStyle)}
              className="w-full text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="bullets">Bullets & Highlighting</option>
              <option value="summary">Executive Summary</option>
              <option value="table">Comparison Table</option>
              <option value="timeline">Chronological Timeline</option>
            </select>

            <button
              type="button"
              onClick={() => {
                if (selectedChapterName) onCleanChapter(selectedChapterName);
              }}
              disabled={isCleaningChapter || !selectedChapterName}
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 disabled:from-slate-200 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-900 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            >
              {isCleaningChapter ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Restructuring...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> Clean Active Chapter
                </>
              )}
            </button>
          </div>
        </div>

        <div className="w-full h-px bg-slate-200 dark:bg-slate-800" />

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <Network className="h-3.5 w-3.5 text-emerald-500" />
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Neural Mindmap</h4>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Generate an interactive concept graph linking ideas from the compiled wiki.
          </p>
          
          <button
            onClick={onGenerateMindmap}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Network className="h-3.5 w-3.5 text-emerald-500" /> Generate Graph
          </button>
        </div>

        <div className="w-full h-px bg-slate-200 dark:bg-slate-800" />

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Inline Assist</h4>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
            <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
              <strong>Tip:</strong> Select any text in the notes paper to trigger the inline HUD. You can highlight, add comments, or ask the Socratic AI to explain the selected concept.
            </p>
          </div>
        </div>

      </div>
    </aside>
  );
}
