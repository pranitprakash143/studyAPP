"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import {
  BookOpen,
  FileText,
  Search,
  Loader2,
  Award,
  Sparkles,
  BarChart2,
  ExternalLink,
  ArrowRight,
  Database,
  Grid,
  FileCode,
  Calendar,
  X,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { getAIHeaders } from "@/lib/settings";

interface StudyNote {
  subject: string;
  topicCount: number;
  chunkCount: number;
  sources: string[];
  topics: string[];
}

interface PyqBank {
  fileName: string;
  subject: string;
  paperCount: number;
  questionCount: number;
  sizeBytes: number;
  modifiedAt: string;
  contentPreview: string;
}

interface NoteHit {
  id: string;
  subject: string;
  topic: string;
  source: string;
  snippet: string;
  timestamp: string;
}

interface PyqHit {
  fileName: string;
  subject: string;
  snippets: string[];
  sizeBytes: number;
}

export default function LibraryExplorer() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [searching, setSearching] = useState(false);

  // Grouped catalogs (Default State)
  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([]);
  const [pyqBanks, setPyqBanks] = useState<PyqBank[]>([]);

  // Search Results
  const [noteHits, setNoteHits] = useState<NoteHit[]>([]);
  const [pyqHits, setPyqHits] = useState<PyqHit[]>([]);

  // Preview Drawer State
  const [previewItem, setPreviewItem] = useState<{ title: string; content: string } | null>(null);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/library", {
        headers: getAIHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStudyNotes(data.studyNotes || []);
        setPyqBanks(data.pyqBanks || []);
      }
    } catch (e) {
      console.error("Failed to load catalog:", e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch catalogs on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCatalog();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Handle deleting subject study notes
  const handleDeleteSubject = async (subject: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete ALL study notes and mindmaps for the subject "${subject}"? This cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`/api/subject?subject=${encodeURIComponent(subject)}`, {
        method: "DELETE",
        headers: getAIHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchCatalog();
      } else {
        alert(data.error || "Failed to delete subject notes.");
      }
    } catch (e) {
      console.error("Failed to delete subject:", e);
      alert("Network error deleting subject notes.");
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting PYQ bank file
  const handleDeletePyq = async (fileName: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete this past year question bank? This cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`/api/pyq?fileName=${encodeURIComponent(fileName)}`, {
        method: "DELETE",
        headers: getAIHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchCatalog();
      } else {
        alert(data.error || "Failed to delete PYQ bank.");
      }
    } catch (e) {
      console.error("Failed to delete PYQ bank:", e);
      alert("Network error deleting PYQ bank.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchMode(false);
      return;
    }

    setSearching(true);
    setSearchMode(true);

    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNoteHits(data.noteHits || []);
        setPyqHits(data.pyqHits || []);
      }
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setSearching(false);
    }
  };

  // Handle clearing search
  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchMode(false);
    setNoteHits([]);
    setPyqHits([]);
  };

  // Handle viewing raw PYQ markdown content preview
  const handlePreviewPYQ = async (bank: PyqBank) => {
    setLoading(true);
    try {
      // Direct raw GET call to fetch notes content if needed, 
      // but to keep it unified, we already pass preview text in contentPreview!
      setPreviewItem({
        title: `PYQ Bank: ${bank.subject} (${bank.paperCount} Papers)`,
        content: bank.contentPreview || "This past paper is currently empty.",
      });
    } catch (err) {
      console.error("Failed to load preview:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0b0f19]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        
        <div className="flex-1 overflow-y-auto">
          <main className="p-8 max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Database className="h-7 w-7 text-indigo-500" />
              Master Library Index
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Explore grouped catalogs of all your study files, revision sheets, and past year question banks.
            </p>
          </div>
        </div>

        {/* Global Search Bar */}
        <form
          onSubmit={handleSearch}
          className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md flex items-center gap-3 mb-8 w-full max-w-4xl mx-auto"
        >
          <Search className="h-5 w-5 text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords across notes, study chapters, and past year papers..."
            className="flex-1 bg-transparent border-none text-slate-800 dark:text-white focus:outline-none text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-full transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-600 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-sm transition"
          >
            Full Library Search
          </button>
        </form>

        {loading && studyNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-24 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-3" />
            <span className="text-xs text-slate-400 dark:text-slate-500">Compiling library catalogs...</span>
          </div>
        ) : searchMode ? (
          /* SEARCH RESULTS VIEW */
          <div className="space-y-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-indigo-500 animate-pulse" />
                Search Results for &ldquo;{searchQuery}&rdquo;
              </h2>
              <button
                onClick={handleClearSearch}
                className="text-xs font-bold text-indigo-500 hover:text-indigo-400"
              >
                Back to All Library Catalog
              </button>
            </div>

            {searching ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
                <span className="text-xs text-slate-400 dark:text-slate-500">Searching both databases...</span>
              </div>
            ) : noteHits.length === 0 && pyqHits.length === 0 ? (
              <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto flex flex-col items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <h3 className="font-bold text-slate-700 dark:text-slate-300">No Results Found</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                  We couldn&apos;t find matches for &ldquo;{searchQuery}&rdquo; in your active study notes or compiled PYQ banks. Adjust spelling or upload more papers!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Note Matches */}
                <div className="space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-500" />
                    Study Library Matches ({noteHits.length})
                  </h3>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {noteHits.map((hit, i) => (
                      <div
                        key={i}
                        className="bg-white dark:bg-[#111726]/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-indigo-500/35 transition duration-150 relative group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 uppercase">
                            {hit.subject}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            Source: {hit.source}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                          {hit.topic}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-mono leading-relaxed bg-slate-50/50 dark:bg-slate-950/30 p-2.5 rounded border border-slate-100 dark:border-slate-900">
                          {hit.snippet}
                        </p>
                        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-900">
                          <a
                            href={`/subject?subject=${encodeURIComponent(hit.subject)}`}
                            className="text-[10px] font-extrabold text-indigo-500 hover:text-indigo-400 flex items-center gap-1.5"
                          >
                            Open Binder <ExternalLink className="h-3 w-3" />
                          </a>
                          <a
                            href={`/quiz?topic=${encodeURIComponent(hit.topic)}&subject=${encodeURIComponent(hit.subject)}`}
                            className="text-[10px] font-extrabold text-indigo-500 hover:text-indigo-400 flex items-center gap-1.5"
                          >
                            Take Quiz <Award className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PYQ Matches */}
                <div className="space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-500" />
                    PYQ Papers Matches ({pyqHits.length})
                  </h3>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {pyqHits.map((hit, i) => (
                      <div
                        key={i}
                        className="bg-white dark:bg-[#111726]/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-indigo-500/35 transition duration-150 group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 uppercase">
                            {hit.subject}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                            {(hit.sizeBytes / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                          {hit.subject} Past Papers Q&As
                        </h4>
                        
                        <div className="space-y-2 mt-2">
                          {hit.snippets.map((snip: string, idx: number) => (
                            <p
                              key={idx}
                              className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic bg-slate-50/50 dark:bg-slate-950/20 p-2 rounded border border-slate-100 dark:border-slate-900"
                            >
                              &ldquo;{snip}&rdquo;
                            </p>
                          ))}
                        </div>

                        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-900">
                          <a
                            href={`/pyq?subject=${encodeURIComponent(hit.subject)}`}
                            className="text-[10px] font-extrabold text-indigo-500 hover:text-indigo-400 flex items-center gap-1.5"
                          >
                            Run Gap Scan <BarChart2 className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* GROUPED CATALOG VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Study Library Catalog */}
            <div className="space-y-4">
              <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-500" />
                Study Library Notes
              </h2>

              {studyNotes.length === 0 ? (
                <div className="p-8 border border-slate-200/50 dark:border-slate-800 rounded-xl text-center bg-white dark:bg-[#111726]/10">
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">No notes ingested yet. Go to Upload.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {studyNotes.map((note, index) => (
                    <div
                      key={index}
                      className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/85 p-5 shadow-sm space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{note.subject}</h3>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5 block">
                            {note.topicCount} Topics • {note.chunkCount} Study segments
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteSubject(note.subject)}
                            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition cursor-pointer"
                            title="Delete Subject Notes"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <a
                            href={`/subject?subject=${encodeURIComponent(note.subject)}`}
                            className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 transition"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </a>
                        </div>
                      </div>

                      {/* Dropdown topics preview */}
                      <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-900 space-y-1.5 max-h-[160px] overflow-y-auto">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">Chapters List</span>
                        {note.topics.map((t, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                            <span className="h-1 w-1 bg-indigo-500 rounded-full shrink-0" />
                            <span className="truncate">{t.split(" - ")[0]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Ingested PYQ Papers */}
            <div className="space-y-4">
              <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-500" />
                PYQ Question Banks
              </h2>

              {pyqBanks.length === 0 ? (
                <div className="p-8 border border-slate-200/50 dark:border-slate-800 rounded-xl text-center bg-white dark:bg-[#111726]/10">
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">No past papers scanned yet. Go to PYQ section.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {pyqBanks.map((bank, index) => (
                    <div
                      key={index}
                      className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/85 p-5 shadow-sm space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{bank.subject} PYQ Repository</h3>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5 block flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" /> Updated on {new Date(bank.modifiedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeletePyq(bank.fileName)}
                            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition cursor-pointer"
                            title="Delete PYQ Bank"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePreviewPYQ(bank)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-extrabold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition cursor-pointer"
                          >
                            Preview Q&As
                          </button>
                          <a
                            href={`/pyq?subject=${encodeURIComponent(bank.subject)}`}
                            className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 transition"
                          >
                            <BarChart2 className="h-4 w-4" />
                          </a>
                        </div>
                      </div>

                      {/* Stat summary grid */}
                      <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-900 text-center shrink-0">
                        <div>
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 block uppercase font-bold">Exam Sheets</span>
                          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5 block">{bank.paperCount}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 block uppercase font-bold">Distilled Q&As</span>
                          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5 block">{bank.questionCount}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 block uppercase font-bold">File Weight</span>
                          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5 block">{(bank.sizeBytes / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PREVIEW MODAL DRAWER OVERLAY */}
        {previewItem && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-end">
            <div className="w-full max-w-xl h-full bg-white dark:bg-[#111726] border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-2xl relative animate-slide-in">
              <button
                onClick={() => setPreviewItem(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-300 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mt-4">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{previewItem.title}</h3>
                </div>
                
                <div className="text-xs text-slate-400 dark:text-slate-500 italic pb-2">
                  Showing high-yield compiled Q&As preview from repository bank:
                </div>

                <div className="flex-1 h-[480px] overflow-y-auto text-sm text-slate-800 dark:text-slate-200 prose dark:prose-invert prose-indigo max-w-none font-mono bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-900 whitespace-pre-wrap leading-relaxed max-h-[500px]">
                  {previewItem.content}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setPreviewItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
        </div>
      </div>
    </div>
  );
}
