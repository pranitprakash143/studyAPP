"use client";

import { Pause, Play, Square } from "lucide-react";

interface TTSPlayerPillProps {
  isPlaying: boolean;
  isPaused: boolean;
  currentBlockIndex: number | null;
  onPause: () => void;
  onPlay: () => void;
  onStop: () => void;
}

export default function TTSPlayerPill({
  isPlaying,
  isPaused,
  currentBlockIndex,
  onPause,
  onPlay,
  onStop,
}: TTSPlayerPillProps) {
  if (!isPlaying && !isPaused) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-slate-900/90 dark:bg-slate-950/90 border border-slate-700/80 dark:border-slate-800/80 rounded-full shadow-2xl backdrop-blur-lg text-white select-none animate-fade-in max-w-sm sm:max-w-md w-max">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPlaying ? "bg-emerald-400" : "bg-amber-400"}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? "bg-emerald-500" : "bg-amber-500"}`} />
      </span>

      <div className="flex flex-col min-w-0 pr-2 border-r border-slate-700/50">
        <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400">Audio Reader</span>
        <span className="text-[11px] font-semibold text-slate-200 truncate max-w-[120px]">
          Reading block {currentBlockIndex !== null ? currentBlockIndex + 1 : 0}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {isPlaying ? (
          <button
            onClick={onPause}
            className="p-1.5 rounded-full hover:bg-slate-800 text-amber-400 transition cursor-pointer"
            title="Pause Reading"
          >
            <Pause className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            onClick={onPlay}
            className="p-1.5 rounded-full hover:bg-slate-800 text-emerald-400 transition cursor-pointer"
            title="Resume Reading"
          >
            <Play className="h-4 w-4 fill-current" />
          </button>
        )}
        
        <button
          onClick={onStop}
          className="p-1.5 rounded-full hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
          title="Stop Reading"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      </div>
    </div>
  );
}
