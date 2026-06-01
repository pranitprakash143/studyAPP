"use client";

import {
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  FileText,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { NewsItem } from "./utils";
import { categoryColors } from "./utils";

interface NewsCardProps {
  item: NewsItem;
  isSaved: boolean;
  isSpeaking: boolean;
  onSave: () => void;
  onToggleSpeak: () => void;
}

export function NewsCard({ item, isSaved, isSpeaking, onSave, onToggleSpeak }: NewsCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 group flex flex-col ${
        isSaved
          ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/5"
          : "border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0c101d] hover:shadow-md hover:border-slate-350 dark:hover:border-slate-700 hover:-translate-y-0.5"
      }`}
    >
      {item.imageUrl && (
        <div className="relative h-44 w-full overflow-hidden shrink-0">
          <img
            src={item.imageUrl}
            alt={item.headline}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-[#0c101d] dark:via-[#0c101d]/90 dark:to-transparent" />
        </div>
      )}

      <div className="p-5 flex flex-col flex-grow relative z-10">
        <div className="flex items-start justify-between gap-4 mb-2.5">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug tracking-tight">
            {item.headline}
          </h3>
          {item.category && (
            <span
              className={`shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                categoryColors[item.category] ||
                "bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {item.category}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed mb-4 flex-grow">
          {item.summary}
        </p>

        <div className="flex items-center justify-between pt-3.5 mt-auto border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-450 dark:text-slate-400">
            <FileText className="h-3 w-3" />
            <span className="font-semibold">{item.source}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {item.examRelevance && (
              <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium mr-2">
                <BookOpen className="h-3 w-3" />
                <span>{item.examRelevance}</span>
              </div>
            )}

            <button
              onClick={onToggleSpeak}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                isSpeaking
                  ? "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/40"
                  : "text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-850"
              }`}
              title={isSpeaking ? "Mute Briefing" : "Play Briefing"}
            >
              {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={onSave}
              disabled={isSaved}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isSaved
                  ? "text-emerald-500 bg-emerald-100/50 dark:bg-emerald-950/20"
                  : "text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-850"
              }`}
              title={isSaved ? "Saved to notes" : "Save to notes"}
            >
              {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SectionRendererProps {
  title: string;
  icon: React.ReactNode;
  items: NewsItem[];
  savedItemIds: Set<string>;
  itemKeyFn: (item: NewsItem) => string;
  speakingHeadline: string | null;
  onSave: (item: NewsItem) => void;
  onToggleSpeak: (item: NewsItem) => void;
}

export function SectionRenderer({
  title,
  icon,
  items,
  savedItemIds,
  itemKeyFn,
  speakingHeadline,
  onSave,
  onToggleSpeak,
}: SectionRendererProps) {
  if (items.length === 0) return null;
  return (
    <div className="mb-12 animate-fade-in">
      <div className="flex items-center gap-2 pb-3 mb-6 border-b border-slate-200 dark:border-slate-800">
        {icon}
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 ml-auto">
          {items.length} stories
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <NewsCard
            key={itemKeyFn(item)}
            item={item}
            isSaved={savedItemIds.has(itemKeyFn(item))}
            isSpeaking={speakingHeadline === item.headline}
            onSave={() => onSave(item)}
            onToggleSpeak={() => onToggleSpeak(item)}
          />
        ))}
      </div>
    </div>
  );
}
