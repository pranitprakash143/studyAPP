"use client";

interface AnnotationPopupProps {
  isOpen: boolean;
  position: { top: number; left: number } | null;
  text: string;
  onChange: (text: string) => void;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export default function AnnotationPopup({
  isOpen,
  position,
  text,
  onChange,
  onSave,
  onCancel,
}: AnnotationPopupProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute z-50 flex flex-col gap-2.5 p-3 bg-slate-900/95 dark:bg-slate-950/95 border border-slate-700 dark:border-slate-800 text-white rounded-xl shadow-2xl backdrop-blur-md select-none -translate-x-1/2 w-64 animate-fade-in"
      style={{ 
        top: `${position ? position.top + 45 : 100}px`, 
        left: `${position ? position.left : 100}px`,
      }}
    >
      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">Add Sticky Comment</div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your personal note comment..."
        className="w-full resize-none h-16 bg-slate-800/80 border border-slate-700 rounded-md p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
      />
      <div className="flex justify-end gap-1.5 select-none">
        <button 
          onClick={onCancel}
          className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white transition cursor-pointer text-center"
        >
          Cancel
        </button>
        <button 
          onClick={() => onSave(text)}
          className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 rounded-md text-white transition cursor-pointer shadow-sm text-center"
        >
          Save Comment
        </button>
      </div>
    </div>
  );
}
