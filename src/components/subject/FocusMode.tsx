"use client";

import { ZoomIn, ZoomOut, X } from "lucide-react";

interface FocusModeProps {
  open: boolean;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onExit: () => void;
  children: React.ReactNode;
}

export default function FocusMode({
  open,
  fontSize,
  onFontSizeChange,
  onExit,
  children,
}: FocusModeProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#ebeaeb] dark:bg-[#080b14] flex flex-col">
      <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 flex items-center gap-4 z-50 opacity-10 hover:opacity-100 transition-opacity duration-300">
        <div className="flex items-center gap-1">
          <button onClick={() => onFontSizeChange(Math.max(12, fontSize - 2))} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-sm font-mono w-6 text-center text-slate-600 select-none">{fontSize}</span>
          <button onClick={() => onFontSizeChange(Math.min(32, fontSize + 2))} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
        <button 
          onClick={onExit}
          className="px-3 py-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white rounded-full text-xs font-bold uppercase tracking-wider transition flex items-center gap-1"
        >
          <X className="h-3 w-3" /> Exit Focus
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-12 w-full flex flex-col items-center">
        <div className="flex-1 mt-4 w-full flex justify-center">
          <div id="print-notes-area-wrapper" className="w-full">
            <div id="print-notes-area">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
