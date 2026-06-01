"use client";

interface UndoToastProps {
  visible: boolean;
  onUndo: () => void;
}

export default function UndoToast({ visible, onUndo }: UndoToastProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900/95 border border-slate-800 shadow-2xl rounded-2xl flex items-center gap-4 shrink-0 font-sans select-none animate-slide-up max-w-md backdrop-blur-md">
      <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">
        ⚡
      </div>
      <div className="flex-1">
        <h4 className="text-xs font-bold text-slate-100">Notes Restructured</h4>
        <p className="text-[10px] text-slate-400 mt-0.5">The chapter has been successfully cleaned and saved.</p>
      </div>
      <button
        onClick={onUndo}
        className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition text-xs font-extrabold cursor-pointer flex items-center gap-1 shadow-inner shrink-0"
      >
        ↩️ Undo
      </button>
    </div>
  );
}
