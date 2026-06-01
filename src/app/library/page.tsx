"use client";

import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import {
  BookOpen,
  FileText,
  Search,
  Award,
  BarChart2,
  ArrowRight,
  Calendar,
  X,
  AlertTriangle,
  Trash2,
  ExternalLink,
  History,
  Sparkles,
  Layers,
  Clock,
  ChevronRight,
  Library,
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

const subjectThemes: Record<string, { gradient: string; icon: typeof BookOpen; lightBg: string }> = {
  History: { gradient: "from-amber-600 to-orange-500", icon: History, lightBg: "bg-amber-50 dark:bg-amber-950/10" },
  Geography: { gradient: "from-emerald-600 to-teal-500", icon: Layers, lightBg: "bg-emerald-50 dark:bg-emerald-950/10" },
  Polity: { gradient: "from-indigo-600 to-blue-500", icon: BookOpen, lightBg: "bg-indigo-50 dark:bg-indigo-950/10" },
  Economics: { gradient: "from-rose-600 to-pink-500", icon: BarChart2, lightBg: "bg-rose-50 dark:bg-rose-950/10" },
  Environment: { gradient: "from-green-600 to-emerald-500", icon: Sparkles, lightBg: "bg-green-50 dark:bg-green-950/10" },
  "Current Affairs": { gradient: "from-violet-600 to-purple-500", icon: Clock, lightBg: "bg-violet-50 dark:bg-violet-950/10" },
  "Science & Tech": { gradient: "from-cyan-600 to-sky-500", icon: Layers, lightBg: "bg-cyan-50 dark:bg-cyan-950/10" },
};

function getSubjectTheme(subject: string) {
  for (const [key, theme] of Object.entries(subjectThemes)) {
    if (subject.startsWith(key) || subject.includes(key)) return theme;
  }
  return { gradient: "from-slate-600 to-slate-500", icon: BookOpen, lightBg: "bg-slate-50 dark:bg-slate-950/10" };
}

export default function LibraryExplorer() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [searching, setSearching] = useState(false);

  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([]);
  const [pyqBanks, setPyqBanks] = useState<PyqBank[]>([]);

  const [noteHits, setNoteHits] = useState<NoteHit[]>([]);
  const [pyqHits, setPyqHits] = useState<PyqHit[]>([]);

  const [previewItem, setPreviewItem] = useState<{ title: string; content: string } | null>(null);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/library", { headers: getAIHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setStudyNotes(data.studyNotes || []);
        setPyqBanks(data.pyqBanks || []);
      }
    } catch {
      console.error("Failed to load catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCatalog() }, []);

  const handleDeleteSubject = async (subject: string) => {
    if (!window.confirm(`Delete ALL notes for "${subject}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/subject?subject=${encodeURIComponent(subject)}`, {
        method: "DELETE",
        headers: getAIHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) fetchCatalog();
      else alert(data.error || "Failed to delete.");
    } catch {
      alert("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePyq = async (fileName: string) => {
    if (!window.confirm("Delete this past year question bank? This cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pyq?fileName=${encodeURIComponent(fileName)}`, {
        method: "DELETE",
        headers: getAIHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) fetchCatalog();
      else alert(data.error || "Failed to delete.");
    } catch {
      alert("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) { setSearchMode(false); return }
    setSearching(true);
    setSearchMode(true);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAIHeaders() },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNoteHits(data.noteHits || []);
        setPyqHits(data.pyqHits || []);
      }
    } catch {
      console.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchMode(false);
    setNoteHits([]);
    setPyqHits([]);
  };

  const subjectCount = studyNotes.length;
  const pyqCount = pyqBanks.length;

  return (
    <PageLayout maxWidth="6xl">
      <div className="relative mb-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Library className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Study Library
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Compiled notes &amp; past paper archives
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{subjectCount} subjects</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{pyqCount} archives</span>
            </div>
          </div>
        </div>
        <div className="mt-5 h-px bg-gradient-to-r from-indigo-500 via-slate-200 dark:via-slate-800 to-transparent" />
      </div>

      <form onSubmit={handleSearch} className="relative mb-10">
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm transition-all duration-200 focus-within:shadow-md focus-within:border-indigo-300 dark:focus-within:border-indigo-700">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across notes, chapters, and past papers..."
            className="flex-1 bg-transparent border-none focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          {searchQuery && (
            <button type="button" onClick={handleClearSearch} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}
          <button type="submit"
            className="px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-sm cursor-pointer">
            Search
          </button>
        </div>
      </form>

      {loading && studyNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="h-10 w-10 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
          <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">Gathering the collection...</p>
        </div>
      ) : searchMode ? (
        <div className="space-y-8 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
              <span className="inline-block w-2 h-2 rounded bg-indigo-500" />
              Results for &ldquo;{searchQuery}&rdquo;
            </h2>
            <button onClick={handleClearSearch}
              className="text-[11px] font-bold tracking-wider text-indigo-600 hover:text-indigo-500 transition cursor-pointer">
              &larr; Back to catalog
            </button>
          </div>

          {searching ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-7 w-7 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin" />
              <p className="mt-3 text-xs font-medium text-slate-500">Searching both databases...</p>
            </div>
          ) : noteHits.length === 0 && pyqHits.length === 0 ? (
            <div className="py-20 text-center max-w-md mx-auto">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">No matches found</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                No results for &ldquo;{searchQuery}&rdquo; in your notes or past papers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold tracking-widest uppercase flex items-center gap-2 text-slate-500">
                  <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                  Notes &mdash; {noteHits.length} hits
                </h3>
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                  {noteHits.map((hit, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">
                          {hit.subject}
                        </span>
                        <span className="text-[10px] text-slate-500">src: {hit.source}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{hit.topic}</h4>
                      <p className="text-xs mt-2 leading-relaxed font-mono p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                        {hit.snippet}
                      </p>
                      <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <a href={`/subject?subject=${encodeURIComponent(hit.subject)}`}
                          className="text-[11px] font-semibold tracking-wider flex items-center gap-1.5 text-indigo-600 hover:text-indigo-500 transition">
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                        <a href={`/quiz?topic=${encodeURIComponent(hit.topic)}&subject=${encodeURIComponent(hit.subject)}`}
                          className="text-[11px] font-semibold tracking-wider flex items-center gap-1.5 text-indigo-600 hover:text-indigo-500 transition">
                          Quiz <Award className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[11px] font-bold tracking-widest uppercase flex items-center gap-2 text-slate-500">
                  <FileText className="h-3.5 w-3.5 text-indigo-500" />
                  Papers &mdash; {pyqHits.length} hits
                </h3>
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                  {pyqHits.map((hit, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">{hit.subject}</span>
                        <span className="text-[10px] font-medium text-slate-500">{(hit.sizeBytes / 1024).toFixed(1)} KB</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{hit.subject} Q&amp;A</h4>
                      <div className="space-y-1.5 mt-2">
                        {hit.snippets.map((snip, idx) => (
                          <p key={idx} className="text-xs leading-relaxed italic p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                            &ldquo;{snip}&rdquo;
                          </p>
                        ))}
                      </div>
                      <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <a href={`/pyq?subject=${encodeURIComponent(hit.subject)}`}
                          className="text-[11px] font-semibold tracking-wider flex items-center gap-1.5 text-indigo-600 hover:text-indigo-500 transition">
                          Gap Scan <BarChart2 className="h-3 w-3" />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-indigo-500 to-purple-500" />
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Study Notes
              </h2>
              <span className="text-[10px] font-mono font-semibold ml-auto text-slate-500">{subjectCount} items</span>
            </div>

            {studyNotes.length === 0 ? (
              <div className="py-16 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30">
                <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-xs text-slate-500">No notes yet. Start by uploading documents.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {studyNotes.map((note, index) => {
                  const theme = getSubjectTheme(note.subject);
                  const IconComponent = theme.icon;
                  const topicList = note.topics.slice(0, 6);

                  return (
                    <div
                      key={index}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${theme.lightBg}`} />
                      <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br ${theme.gradient} opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500 -translate-y-12 translate-x-12 pointer-events-none`} />

                      <div className="relative p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                              <IconComponent className="h-5 w-5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {note.subject}
                              </h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {note.topicCount} chapters
                                </span>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {note.chunkCount} segments
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-3 shrink-0">
                            <button
                              onClick={() => handleDeleteSubject(note.subject)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                              title="Delete subject">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <a
                              href={`/subject?subject=${encodeURIComponent(note.subject)}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition cursor-pointer">
                              <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                            </a>
                          </div>
                        </div>

                        {topicList.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {topicList.map((t, idx) => (
                              <span key={idx}
                                className="text-[10px] px-2.5 py-1 rounded-full font-medium border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 group-hover:border-indigo-200 dark:group-hover:border-indigo-900/50 transition-colors">
                                {t.split(" - ")[0]}
                              </span>
                            ))}
                            {note.topics.length > 6 && (
                              <span className="text-[10px] px-2.5 py-1 rounded-full font-medium text-slate-400 bg-slate-100 dark:bg-slate-800">
                                +{note.topics.length - 6} more
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <FileText className="h-3 w-3" />
                            <span>{note.sources.length} source{note.sources.length !== 1 ? "s" : ""}</span>
                          </div>
                          <a
                            href={`/subject?subject=${encodeURIComponent(note.subject)}`}
                            className="text-[11px] font-semibold tracking-wider flex items-center gap-1.5 text-indigo-600 hover:text-indigo-500 transition group/link">
                            Open <ArrowRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500" />
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Question Archives
              </h2>
              <span className="text-[10px] font-mono font-semibold ml-auto text-slate-500">{pyqCount} archives</span>
            </div>

            {pyqBanks.length === 0 ? (
              <div className="py-16 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30">
                <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-xs text-slate-500">No past papers indexed yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pyqBanks.map((bank, index) => (
                  <div
                    key={index}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500 -translate-y-12 translate-x-12 pointer-events-none" />

                    <div className="relative p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-300">
                            <FileText className="h-5 w-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {bank.subject} Archives
                            </h3>
                            <p className="text-[10px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <Calendar className="h-3 w-3" />
                              {new Date(bank.modifiedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-3 shrink-0">
                          <button
                            onClick={() => handleDeletePyq(bank.fileName)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                            title="Delete PYQ bank">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setPreviewItem({
                                title: `PYQ Bank: ${bank.subject} (${bank.paperCount} Papers)`,
                                content: bank.contentPreview || "This past paper is currently empty.",
                              });
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                            title="Preview">
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={`/pyq?subject=${encodeURIComponent(bank.subject)}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition cursor-pointer">
                            <BarChart2 className="h-4 w-4" />
                          </a>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                        <div className="text-center">
                          <span className="text-[8px] font-bold tracking-wider block uppercase text-slate-500">Papers</span>
                          <span className="text-base font-bold text-slate-900 dark:text-white">{bank.paperCount}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[8px] font-bold tracking-wider block uppercase text-slate-500">Questions</span>
                          <span className="text-base font-bold text-slate-900 dark:text-white">{bank.questionCount}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[8px] font-bold tracking-wider block uppercase text-slate-500">Size</span>
                          <span className="text-base font-bold text-slate-900 dark:text-white">{(bank.sizeBytes / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 flex justify-end border-t border-slate-100 dark:border-slate-800">
                        <a
                          href={`/pyq?subject=${encodeURIComponent(bank.subject)}`}
                          className="text-[11px] font-semibold tracking-wider flex items-center gap-1.5 text-emerald-600 hover:text-emerald-500 transition group/link">
                          Gap Scan <ArrowRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-xl h-full p-6 flex flex-col bg-white dark:bg-slate-900 shadow-2xl relative border-l border-slate-200 dark:border-slate-800 animate-slide-in-right">
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute top-5 right-5 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
              <X className="h-4 w-4 text-slate-400" />
            </button>

            <div className="flex-1 space-y-4 mt-4">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
                <FileText className="h-4 w-4 text-indigo-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {previewItem.title}
                </h3>
              </div>

              <p className="text-[11px] italic text-slate-500">
                Compiled Q&amp;A preview from archive:
              </p>

              <div className="h-[480px] overflow-y-auto text-sm leading-relaxed font-mono p-4 rounded-xl whitespace-pre-wrap custom-scrollbar bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                {previewItem.content}
              </div>
            </div>

            <div className="pt-4 flex justify-end mt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
