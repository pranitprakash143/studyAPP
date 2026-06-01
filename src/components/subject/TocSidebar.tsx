"use client";

import { X, List, Edit3, Trash2, Loader2, Sparkles } from "lucide-react";
import { formatDisplayName } from "@/lib/utils";
import type { TopicNode } from "@/lib/subject/types";

interface HighlightData {
  id: string;
  subject: string;
  topic: string;
  text: string;
  color: string;
  note?: string;
  createdAt: string;
}

interface TocSidebarProps {
  tocCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenCollapse: () => void;
  topics: TopicNode[];
  sidebarTab: "chapters" | "highlights";
  onSidebarTabChange: (tab: "chapters" | "highlights") => void;
  highlights: HighlightData[];
  editingTopicName: string | null;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartEditing: (name: string) => void;
  onStopEditing: () => void;
  onRename: (oldName: string, oldFullName: string, newName: string) => void;
  onDelete: (name: string) => void;
  onDeleteHighlight: (id: string) => void;
  onScrollToTopic: (fullName: string, topicName: string) => void;
  onFixLinks: () => void;
  fixingLinks: boolean;
  markdown: string;
  previewContainerRef: React.RefObject<HTMLDivElement | null>;
}

export default function TocSidebar({
  tocCollapsed,
  onOpenCollapse,
  onToggleCollapse,
  topics,
  sidebarTab,
  onSidebarTabChange,
  highlights,
  editingTopicName,
  editValue,
  onEditValueChange,
  onStartEditing,
  onStopEditing,
  onRename,
  onDelete,
  onDeleteHighlight,
  onScrollToTopic,
  onFixLinks,
  fixingLinks,
  markdown,
  previewContainerRef,
}: TocSidebarProps) {
  return (
    <>
      {tocCollapsed && (
        <button
          type="button"
          onClick={onOpenCollapse}
          className="absolute top-4 left-4 z-30 p-2.5 rounded-xl bg-white/80 dark:bg-[#111726]/85 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/40 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/30 shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 group cursor-pointer flex items-center justify-center animate-fade-in hover:scale-105"
          title="Open Table of Contents"
        >
          <List className="h-4 w-4 transition-transform duration-300 group-hover:rotate-6" />
          <span className="w-0 overflow-hidden group-hover:w-20 group-hover:ml-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 block whitespace-nowrap">
            Contents
          </span>
        </button>
      )}

      <aside
        className={`bg-white dark:bg-[#111726] border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 shrink-0 select-none ${
          tocCollapsed ? "w-0 overflow-hidden" : "w-60"
        }`}
      >
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1.5 font-sans">
            <List className="h-3.5 w-3.5 text-indigo-500" /> Contents
          </span>
          <div className="flex items-center gap-2 select-none">
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-md border border-indigo-500/10">
              {topics.length} CH
            </span>
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition cursor-pointer flex items-center justify-center"
              title="Close Table of Contents"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="px-2 pt-1.5 pb-0.5 shrink-0">
          <button
            onClick={onFixLinks}
            disabled={fixingLinks || !markdown}
            className="w-full py-1 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/15 hover:border-indigo-500/30"
          >
            {fixingLinks ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {fixingLinks ? "Fixing Links..." : "🔗 Fix Links"}
          </button>
        </div>

        <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1 shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
          <button onClick={() => onSidebarTabChange("chapters")}
            className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer text-center ${
              sidebarTab === "chapters"
                ? "bg-white dark:bg-slate-750 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-600"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}>
            Chapters
          </button>
          <button onClick={() => onSidebarTabChange("highlights")}
            className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1 text-center ${
              sidebarTab === "highlights"
                ? "bg-white dark:bg-slate-750 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-600"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}>
            Highlights {highlights.length > 0 && (
              <span className="inline-flex items-center justify-center bg-indigo-500 text-white rounded-full w-4 h-4 text-[8px] font-bold select-none">
                {highlights.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2 select-text">
          {sidebarTab === "chapters" ? (
            topics.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 italic leading-relaxed select-none">
                No chapters found. Add a topic section to get started.
              </div>
            ) : (
              topics.map((t, idx) => {
                const isEditing = editingTopicName === t.name;
                return (
                  <div key={idx} className="w-full flex flex-col select-none group border-b border-slate-100/50 dark:border-slate-800/20 pb-2">
                    <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition duration-150 relative">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => onEditValueChange(e.target.value)}
                          onBlur={() => onRename(t.name, t.fullName, editValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onRename(t.name, t.fullName, editValue);
                            else if (e.key === "Escape") onStopEditing();
                          }}
                          className="flex-1 px-1.5 py-0.5 border border-indigo-500 rounded bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-slate-900 dark:text-slate-100 font-medium"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <button onClick={() => onScrollToTopic(t.fullName, t.name)}
                          className="flex-1 text-left flex items-start gap-2 min-w-0 cursor-pointer">
                          <span className="text-[10px] font-extrabold text-indigo-500 dark:text-indigo-400 mt-px w-4 shrink-0 text-right">{idx + 1}</span>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate leading-snug font-bold hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t.name}</span>
                            {t.sources.length > 0 && (
                              <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 block truncate mt-0.5 uppercase tracking-wider">
                                📂 {t.sources.map(formatDisplayName).join(", ")}
                              </span>
                            )}
                          </div>
                        </button>
                      )}
                      
                      {!isEditing && (
                        <div className="flex items-center gap-0.5 ml-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button type="button" onClick={(e) => { e.stopPropagation(); onStartEditing(t.name); }}
                            className="p-1 rounded hover:bg-indigo-500/10 hover:text-indigo-500 text-slate-400 transition cursor-pointer" title="Rename Chapter">
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(t.name); }}
                            className="p-1 rounded hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 transition cursor-pointer" title="Delete Chapter">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {t.subsections && t.subsections.length > 0 && (
                      <div className="pl-4 pr-2 mt-0.5 border-l border-slate-200/60 dark:border-slate-800/80 ml-5 py-0.5 space-y-1 text-[11px] font-medium">
                        {t.subsections.map((sub, sIdx) => (
                          <button key={sIdx} type="button"
                            onClick={() => onScrollToTopic(sub.fullName, sub.name)}
                            className="w-full text-left truncate py-0.5 px-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer block transition duration-150 relative truncate"
                            title={sub.name}>
                            <span className="text-[10px] text-slate-400 dark:text-slate-600 mr-1 select-none">├─</span>
                            <span className="truncate">{sub.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            highlights.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 italic leading-relaxed select-none">
                No highlights yet. Select notes text to highlight.
              </div>
            ) : (
              highlights.map((h) => (
                <div key={h.id}
                  className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 transition select-none group relative bg-white dark:bg-[#151c2e] hover:shadow-sm cursor-pointer animate-fade-in ${
                    h.color === "green" ? "border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-300"
                    : h.color === "pink" ? "border-pink-200 dark:border-pink-900/50 hover:border-pink-300"
                    : h.color === "blue" ? "border-sky-200 dark:border-sky-900/50 hover:border-sky-300"
                    : "border-amber-200 dark:border-amber-900/50 hover:border-amber-300"
                  }`}
                  onClick={() => {
                    if (previewContainerRef.current) {
                      const els = Array.from(previewContainerRef.current.querySelectorAll("span"));
                      const matched = els.find(el => el.textContent?.trim().toLowerCase() === h.text.trim().toLowerCase());
                      if (matched) {
                        matched.scrollIntoView({ behavior: "smooth", block: "center" });
                        matched.classList.add("scale-105", "shadow-md");
                        setTimeout(() => matched.classList.remove("scale-105", "shadow-md"), 1000);
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-3 h-3 rounded-full border ${
                      h.color === "green" ? "bg-emerald-400/30 border-emerald-500"
                      : h.color === "pink" ? "bg-pink-400/30 border-pink-500"
                      : h.color === "blue" ? "bg-sky-400/30 border-sky-500"
                      : "bg-amber-400/30 border-amber-500"
                    }`} />
                    <button onClick={(e) => { e.stopPropagation(); onDeleteHighlight(h.id); }}
                      className="p-1 rounded text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                      title="Delete Highlight">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 font-sans italic leading-normal border-l-2 border-slate-200 dark:border-slate-700 pl-2 max-h-16 overflow-hidden text-ellipsis line-clamp-3 select-text select-none">
                    &quot;{h.text}&quot;
                  </div>
                  {h.note && (
                    <div className="mt-1 bg-slate-50 dark:bg-slate-900 p-2 rounded-md border border-slate-100 dark:border-slate-800 text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-400 flex items-start gap-1 select-text">
                      <span className="text-[11px] shrink-0 mt-px select-none">💬</span>
                      <div className="flex-1 font-sans">{h.note}</div>
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>
      </aside>
    </>
  );
}
