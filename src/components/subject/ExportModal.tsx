"use client";

import { X, FileText, BookOpen, Printer } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadMarkdown: () => void;
  onDownloadDocx: () => void;
  onPrintPdf: () => void;
}

export default function ExportModal({
  isOpen,
  onClose,
  onDownloadMarkdown,
  onDownloadDocx,
  onPrintPdf,
}: ExportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none p-4">
      <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl w-full animate-fade-in text-slate-800 dark:text-slate-200">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Export Subject Binder</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Download subject notes in your preferred format</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/20 hover:border-indigo-500 dark:hover:border-indigo-500 transition duration-200 flex flex-col items-center text-center">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-2xl mb-3 shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Markdown (.md)</h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mb-4 flex-1">
              Perfect for importing notes into Notion, Obsidian, or raw editing.
            </p>
            <button
              onClick={onDownloadMarkdown}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              Download MD
            </button>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/20 hover:border-indigo-500 dark:hover:border-indigo-500 transition duration-200 flex flex-col items-center text-center">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-2xl mb-3 shrink-0">
              <BookOpen className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Word Document (.docx)</h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mb-4 flex-1">
              Fully styled document that opens cleanly in MS Word, Google Docs, or Pages.
            </p>
            <button
              onClick={onDownloadDocx}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              Download DOCX
            </button>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/20 hover:border-indigo-500 dark:hover:border-indigo-500 transition duration-200 flex flex-col items-center text-center">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-2xl mb-3 shrink-0">
              <Printer className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">High-Fidelity PDF</h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mb-4 flex-1">
              Paginated, ink-efficient print layout. Save as PDF or print directly.
            </p>
            <button
              onClick={onPrintPdf}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
