"use client";

import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import ErrorAlert from "@/components/ErrorAlert";
import StatusBadge from "@/components/StatusBadge";
import {
  BookOpen,
  Search,
  Download,
  BrainCircuit,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  BookMarked,
  FileText,
} from "lucide-react";
import { getAIHeaders, HARDCODED_SUBJECTS } from "@/lib/settings";
import CustomDropdown from "@/components/CustomDropdown";

interface Stats {
  subjects: string[];
  sources: string[];
}

export default function Notes() {
  // Query states
  const [query, setQuery] = useState("");
  
  const subjectFilterOptions = [
    { value: "All", label: "All Subjects", icon: "🌐" },
    ...HARDCODED_SUBJECTS.map((sub) => ({
      value: sub,
      label: sub,
      icon: "📚",
    })),
  ];
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Note generation states
  const [generating, setGenerating] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState<string>("");
  const [sourcesUsed, setSourcesUsed] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  // Master KB Raw Viewer states
  const [masterKbContent, setMasterKbContent] = useState<string>("");
  const [viewingRaw, setViewingRaw] = useState(false);

  useEffect(() => {
    // Read stats from API
    async function loadStats() {
      try {
        const res = await fetch("/api/notes", {
          method: "GET",
          headers: getAIHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setStats(data.stats);
          }
        }
      } catch (e) {
        console.error("Failed to load notes page statistics:", e);
      }
    }

    // Capture potential subject search from query params (pushed from dashboard)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const subj = params.get("subject");
      if (subj) {
        setSubjectFilter(subj);
        setQuery(`Core summary sheet for ${subj}`);
      }
    }

    loadStats();
  }, []);

  const handleGenerateNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setGenerating(true);
    setErrorMessage("");
    setGeneratedNotes("");
    setSourcesUsed([]);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          query,
          subjectFilter: subjectFilter === "All" ? undefined : subjectFilter,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedNotes(data.notes);
        setSourcesUsed(data.sourcesUsed);
      } else {
        setErrorMessage(data.error || "RAG engine failed to locate related segments in master KB.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to contact the RAG Notes generator.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadNotes = () => {
    if (!generatedNotes) return;
    const blob = new Blob([generatedNotes], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PrepAgent_Notes_${query.replace(/\s+/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFetchMasterKb = async () => {
    setViewingRaw(true);
    setMasterKbContent("Loading master knowledge base document...");
    try {
      // Create a specific utility API route to load the raw file or use search fallback
      const res = await fetch("/api/notes?raw=true", {
        method: "GET",
        headers: getAIHeaders(),
      });
      // We can also fetch the notes API stats, but let's implement the master file loader directly
      // Or search using a generic endpoint
      // We can easily fetch the raw master text! Let's build a quick fetch
      // Wait, we didn't add the `raw=true` handler to GET `/api/notes` yet, but let's add it!
      // In `/api/notes/route.ts` we have:
      // const masterKbSize = getMasterKbContent().length;
      // Let's modify it or just fetch a mock. Actually, let's write a simple client-side load.
      // Wait, let's first check if we should add raw content to the stats endpoint. Yes, let's do a simple check.
      // Wait, in `/api/notes/route.ts` GET, we can add a check for query parameter `raw`. Let's check how we wrote it:
      // we only returned totalSubjects, totalSources, etc. Let's make an API call to load raw!
      const rawRes = await fetch("/api/notes");
      const rawData = await rawRes.json();
      if (rawData.success) {
        // We will fetch the master file directly.
        // Wait, let's create a small client handler or call endpoint. Let's fetch it.
        const response = await fetch("/api/notes?raw=true");
        // Wait! Let's edit `src/app/api/notes/route.ts` to support reading raw master KB content!
        // That is very clean. Let's do that! But first, let's write the frontend Notes component.
      }
    } catch (e) {
      setMasterKbContent("Failed to load master knowledge base.");
    }
  };

  const loadRawKbText = async () => {
    setViewingRaw(true);
    setMasterKbContent("Fetching complete raw Master Copy...");
    try {
      const res = await fetch("/api/notes");
      const data = await res.json();
      // Let's fetch the actual master KB content by requesting it from server
      const fileRes = await fetch("/api/notes?raw=true");
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        setMasterKbContent(fileData.rawContent || "*Knowledge base is currently empty.*");
      }
    } catch (e) {
      setMasterKbContent("Failed to load master content.");
    }
  };

  return (
    <PageLayout>
      <PageHeader
        icon={<BookOpen className="h-6 w-6" />}
        title="RAG Notes Workspace"
        description="Synthesize high-yield custom notes, completely grounded in your master syllabus documents."
      >
        <button
          onClick={() => {
            if (viewingRaw) {
              setViewingRaw(false);
            } else {
              loadRawKbText();
            }
          }}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-white dark:bg-[#111726] hover:bg-slate-50 dark:hover:bg-slate-900/50 transition flex items-center gap-1.5"
        >
          <BookMarked className="h-4 w-4" />
          {viewingRaw ? "Hide Master Copy" : "View Master Copy"}
        </button>
      </PageHeader>

      {/* Content Panel Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
        
        {/* Left / Generator Panel */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          
          {/* Note Synthesis Form */}
            <form onSubmit={handleGenerateNotes} className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 flex flex-col gap-1.5 w-full">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    What topic would you like revision notes on?
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 text-slate-400 dark:text-slate-500 h-4.5 w-4.5" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g. Explain Photosynthesis Light Reactions, Mughal Administration"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 w-full md:w-48">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                    Subject Filter
                  </label>
                  <CustomDropdown
                    options={subjectFilterOptions}
                    value={subjectFilter}
                    onChange={setSubjectFilter}
                  />
                </div>

                <button
                  type="submit"
                  disabled={generating || !query.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 transition shrink-0 h-10 w-full md:w-auto"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Synthesizing...
                    </>
                  ) : (
                    "Generate Notes"
                  )}
                </button>
              </div>
            </form>

            {/* Note Output Screen */}
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 flex-1 flex flex-col min-h-96 relative">
              {generating ? (
                <div className="my-auto flex flex-col items-center justify-center text-center p-8 gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                  <h3 className="font-bold text-slate-700 dark:text-slate-200">Querying Master Index...</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
                    PrepAgent is searching your master Markdown syllabus, pulling matching sections, and synthesizing revision sheets with strict anti-hallucination guardrails.
                  </p>
                </div>
              ) : errorMessage ? (
                <div className="my-auto flex flex-col items-center justify-center text-center p-8 gap-3 text-rose-500">
                  <AlertTriangle className="h-10 w-10" />
                  <h3 className="font-bold">Synthesis Blocked</h3>
                  <p className="text-xs text-slate-500 max-w-xs">{errorMessage}</p>
                </div>
              ) : generatedNotes ? (
                <div className="flex-1 flex flex-col h-full">
                  {/* Notes Header Utilities */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6 shrink-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase">
                      <CheckCircle2 className="h-4.5 w-4.5" /> High-Yield Study Sheet Complete
                    </div>
                    <button
                      onClick={handleDownloadNotes}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> Download MD
                    </button>
                  </div>

                  {/* Notes Markdown Viewer */}
                  <div className="flex-1 overflow-y-auto pr-1 max-h-[500px] border border-slate-100 dark:border-slate-900 p-6 rounded-xl bg-slate-50/30 dark:bg-[#0b0f19]/30">
                    <div className="prose prose-slate dark:prose-invert prose-sm max-w-none text-slate-700 dark:text-slate-300 leading-relaxed font-sans space-y-4">
                      {/* Very simple markdown parser for rendering study text nicely */}
                      {generatedNotes.split("\n").map((line, idx) => {
                        if (line.startsWith("# ")) {
                          return <h1 key={idx} className="text-2xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 mt-6 mb-4">{line.replace("# ", "")}</h1>;
                        }
                        if (line.startsWith("## ")) {
                          const title = line.replace("## ", "").replace("Topic:", "").trim();
                          return (
                            <div key={idx} className="relative my-8 pt-8 pb-3 border-t border-dashed border-slate-200 dark:border-slate-800/80 w-full select-none">
                              <div className="absolute -top-3.5 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500 border border-indigo-500/25">
                                📖 Chapter Section
                              </div>
                              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-2 mb-1">{title}</h2>
                            </div>
                          );
                        }
                        if (line.startsWith("### ")) {
                          return <h3 key={idx} className="text-sm font-bold text-slate-800 dark:text-white mt-4 mb-2">{line.replace("### ", "")}</h3>;
                        }
                        if (line.startsWith("> ")) {
                          return (
                            <blockquote key={idx} className="border-l-4 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 px-4 py-2 rounded-r-lg text-xs my-3 italic">
                              {line.replace("> ", "")}
                            </blockquote>
                          );
                        }
                        if (line.startsWith("- ") || line.startsWith("* ")) {
                          const boldText = line.replace(/^[-*]\s+/, "");
                          // Simple bold parser
                          const parts = boldText.split("**");
                          return (
                            <li key={idx} className="ml-4 list-disc text-sm py-0.5">
                              {parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-bold text-slate-900 dark:text-white">{p}</strong> : p))}
                            </li>
                          );
                        }
                        if (line.trim() === "---") {
                          return <hr key={idx} className="my-6 border-slate-200 dark:border-slate-800" />;
                        }
                        // Default paragraph
                        const parts = line.split("**");
                        return (
                          <p key={idx} className="text-sm my-2">
                            {parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-bold text-slate-900 dark:text-white">{p}</strong> : p))}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="my-auto text-center p-8">
                  <BrainCircuit className="h-12 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-500">Study Workspace</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    Type a topic above to generate complete, high-yield summary revision notes with citation footnotes based on your uploaded files.
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Right Side Master KB Viewer / RAG statistics */}
          <div className="space-y-6">
            
            {/* Context Ingestion alert box */}
            <div className="bg-[#111726] border border-indigo-900/60 p-5 rounded-2xl text-xs space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-bold">
                <BrainCircuit className="h-4 w-4" /> Dual Embedding-Token Core
              </div>
              <p className="text-slate-400 leading-relaxed">
                When using Cloud Gemini, PrepAgent retrieves chunks via deep learning semantic embeddings. When offline, we run a zero-dependency term frequency index, ensuring you get perfect RAG results in any environment.
              </p>
            </div>

            {/* Master KB raw file rendering */}
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 min-h-80 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  Master Syllabus Ledger
                </h3>
                
                {viewingRaw ? (
                  <div className="text-xs p-3 rounded-xl border border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-[#0b0f19]/30 h-96 overflow-y-auto font-mono text-slate-500 dark:text-slate-400 whitespace-pre-wrap leading-normal">
                    {masterKbContent}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                      All your uploaded documents, images, and videos are parsed, cleaned, and compiled into a single master study copy:
                    </p>
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#151c2f]/40 flex items-center gap-3">
                      <BookMarked className="h-5 w-5 text-indigo-500" />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">master_kb.md</span>
                        <span className="text-slate-400 mt-0.5 block">Located in project files</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!viewingRaw && (
                <button
                  onClick={loadRawKbText}
                  className="mt-6 w-full py-2.5 rounded-xl text-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 text-xs font-bold transition flex items-center justify-center gap-1"
                >
                  Open Complete Ledger <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Sources Citation List */}
            {generatedNotes && sourcesUsed.length > 0 && (
              <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6">
                <h3 className="text-xs uppercase font-bold text-slate-400 mb-3">Sources Cited In Sheet</h3>
                <div className="space-y-2">
                  {sourcesUsed.map((src) => (
                    <div
                      key={src}
                      className="text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300 truncate"
                    >
                      {src}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

      </div>
    </PageLayout>
  );
}
