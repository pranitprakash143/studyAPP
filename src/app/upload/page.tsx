"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import {
  UploadCloud,
  Video,
  FileText,
  BookOpen,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  XCircle
} from "lucide-react";
import { getAIHeaders, HARDCODED_SUBJECTS } from "@/lib/settings";
import CustomDropdown from "@/components/CustomDropdown";

// ── Ingestion limits (must match backend/core/config.py) ─────────────────────
const MAX_UPLOAD_SIZE_MB = 15;
const MAX_INGEST_CHARS = 80_000;
const SOFT_WARN_CHARS = 60_000;

type IngestionState = "idle" | "uploading" | "ocr_extracting" | "formatting" | "indexing" | "success" | "error";

interface ExtractedSection {
  title: string;
  content: string;
}

export interface PipelineNode {
  id: "analyze" | "upload" | "parse" | "clean" | "structure" | "subtopic" | "embed" | "mindmap";
  label: string;
  description: string;
  status: "pending" | "processing" | "success" | "failed";
}

const INITIAL_PIPELINE_NODES: PipelineNode[] = [
  { id: "analyze", label: "Document Structure Analysis", description: "AI reads full document to map chapters, subtopics, themes, and glossary terms", status: "pending" },
  { id: "upload", label: "Document Reception", description: "Verifying subject folders and uploading file stream", status: "pending" },
  { id: "parse", label: "Text Decoupling & OCR", description: "Scanning pages, processing text fragments, and extracting raw contents", status: "pending" },
  { id: "clean", label: "LangGraph Content Cleanse", description: "Standardizing typography formats and stripping structural noise", status: "pending" },
  { id: "structure", label: "TOC Academic Synthesis", description: "Structuring content into organized chapters, highlights, and headers", status: "pending" },
  { id: "subtopic", label: "Subtopic-Level Indexing", description: "Splitting chapters into granular subtopic chunks for precise semantic retrieval", status: "pending" },
  { id: "embed", label: "Vector Database Indexing", description: "Generating vector embeddings and indexing subtopic chunks into ChromaDB RAG store", status: "pending" },
  { id: "mindmap", label: "2D Mindmap Synthesis", description: "Compiling semantic relationships to map cross-chapter concept nodes", status: "pending" }
];

export default function Upload() {
  const [activeTab, setActiveTab] = useState<"file" | "youtube" | "paste">("file");
  
  const subjectOptions = HARDCODED_SUBJECTS.map((sub) => ({
    value: sub,
    label: sub,
    icon: "📚",
  }));
  
  const [subject, setSubject] = useState(HARDCODED_SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [status, setStatus] = useState<IngestionState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [ingestedResult, setIngestedResult] = useState<{
    subject: string;
    topic: string;
    source: string;
    sections: ExtractedSection[];
    subtopicCount?: number;
  } | null>(null);

  const [pipelineNodes, setPipelineNodes] = useState<PipelineNode[]>(INITIAL_PIPELINE_NODES);
  const [activePipelineIndex, setActivePipelineIndex] = useState<number>(-1);
  const pipelineIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (pipelineIntervalRef.current) clearTimeout(pipelineIntervalRef.current);
    };
  }, []);

  const getLineClass = (index: number) => {
    const current = pipelineNodes[index];
    const next = pipelineNodes[index + 1];
    if (!next) return "";
    
    if (current.status === "success") {
      if (next.status === "success") return "bg-emerald-500";
      if (next.status === "processing") return "glowing-line-active";
      if (next.status === "failed") return "bg-rose-500";
      return "bg-emerald-500"; 
    }
    if (current.status === "processing") {
      return "glowing-line-active";
    }
    if (current.status === "failed") {
      return "bg-rose-200 dark:bg-rose-950/40";
    }
    return "bg-slate-200 dark:bg-slate-800";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > MAX_UPLOAD_SIZE_MB) {
        setErrorMessage(`File is too large (${sizeMB.toFixed(1)} MB). Maximum allowed size is ${MAX_UPLOAD_SIZE_MB} MB for optimal AI processing.`);
        setStatus("error");
        return;
      }
      setSelectedFile(file);
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      if (!topic) {
        setTopic(baseName);
      }
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const startPipelineAnimation = () => {
    setPipelineNodes(INITIAL_PIPELINE_NODES.map(node => ({ ...node, status: "pending" })));
    setActivePipelineIndex(0);
    
    if (pipelineIntervalRef.current) clearTimeout(pipelineIntervalRef.current);
    
    const durations = [2000, 1500, 2500, 3500, 4000, 3000, 3000, 3000]; 
    let currentIndex = 0;
    
    setPipelineNodes(prev => prev.map((n, idx) => idx === 0 ? { ...n, status: "processing" } : n));
    
    const runNextStep = () => {
      if (currentIndex >= durations.length - 1) {
        if (pipelineIntervalRef.current) clearTimeout(pipelineIntervalRef.current);
        return;
      }
      
      setPipelineNodes(prev => prev.map((n, idx) => {
        if (idx === currentIndex) return { ...n, status: "success" };
        if (idx === currentIndex + 1) return { ...n, status: "processing" };
        return n;
      }));
      
      currentIndex++;
      setActivePipelineIndex(currentIndex);
      
      pipelineIntervalRef.current = setTimeout(runNextStep, durations[currentIndex]);
    };
    
    pipelineIntervalRef.current = setTimeout(runNextStep, durations[0]);
  };

  const completePipelineSuccess = () => {
    if (pipelineIntervalRef.current) clearTimeout(pipelineIntervalRef.current);
    setPipelineNodes(prev => prev.map(n => ({ ...n, status: "success" })));
    setActivePipelineIndex(-1);
  };

  const completePipelineFailed = () => {
    if (pipelineIntervalRef.current) clearTimeout(pipelineIntervalRef.current);
    setPipelineNodes(prev => {
      let targetIndex = prev.findIndex(n => n.status === "processing");
      if (targetIndex === -1) targetIndex = Math.max(0, activePipelineIndex);
      return prev.map((n, idx) => {
        if (idx === targetIndex) return { ...n, status: "failed" };
        return n;
      });
    });
    setActivePipelineIndex(-1);
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setErrorMessage("Please select a subject name.");
      setStatus("error");
      return;
    }

    if (activeTab === "paste" && pastedText.length > MAX_INGEST_CHARS) {
      setErrorMessage(
        `Text is too long (${pastedText.length.toLocaleString()} characters). ` +
        `Maximum allowed is ${MAX_INGEST_CHARS.toLocaleString()} characters (~40 pages) for optimal AI processing. ` +
        `Please split your material into smaller sections.`
      );
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setErrorMessage("");
    setIngestedResult(null);
    startPipelineAnimation();

    const formData = new FormData();
    formData.append("subject", subject.trim());
    formData.append("topic", topic.trim());

    if (activeTab === "file" && selectedFile) {
      formData.append("file", selectedFile);
    } else if (activeTab === "youtube" && youtubeUrl) {
      formData.append("youtubeUrl", youtubeUrl.trim());
    } else if (activeTab === "paste" && pastedText) {
      formData.append("pastedText", pastedText.trim());
    } else {
      setErrorMessage("Please supply a video link, paste text, or select a document.");
      setStatus("error");
      completePipelineFailed();
      return;
    }

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: getAIHeaders(),
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.status === "processing" && data.jobId) {
          // Poll for status
          const pollJob = async (jobId: string) => {
            try {
              const jobRes = await fetch(`/api/jobs/${jobId}`);
              const jobData = await jobRes.json();
              if (jobData.status === "completed") {
                completePipelineSuccess();
                const result = jobData.result;
                const subtopicCount = result.sections?.length || 0;
                setIngestedResult({
                  subject: result.subject,
                  topic: result.topic,
                  source: result.source,
                  sections: result.chapters, // result.chapters comes from backend
                  subtopicCount,
                });
                setStatus("success");
                setSelectedFile(null);
                setYoutubeUrl("");
                setPastedText("");
              } else if (jobData.status === "failed") {
                completePipelineFailed();
                setErrorMessage(jobData.error || "Ingestion pipeline encountered an error.");
                setStatus("error");
              } else {
                // Still processing, poll again after 2 seconds
                setTimeout(() => pollJob(jobId), 2000);
              }
            } catch (err) {
              completePipelineFailed();
              setErrorMessage("Error checking job status.");
              setStatus("error");
            }
          };
          pollJob(data.jobId);
        } else {
          // Synchronous response fallback
          completePipelineSuccess();
          const subtopicCount = data.sections?.length || 0;
          setIngestedResult({
            subject: data.subject,
            topic: data.topic,
            source: data.source,
            sections: data.sections,
            subtopicCount,
          });
          setStatus("success");
          
          setSelectedFile(null);
          setYoutubeUrl("");
          setPastedText("");
        }
      } else {
        completePipelineFailed();
        setErrorMessage(data.error || "Ingestion pipeline encountered an error.");
        setStatus("error");
      }
    } catch (err: unknown) {
      completePipelineFailed();
      const msg = err instanceof Error ? err.message : "Network error. Ingestion failed.";
      setErrorMessage(msg);
      setStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0b0f19]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        
        <div className="flex-1 overflow-y-auto">
          <main className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Ingest Syllabus Material
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Process syllabus documents, handwritten notes, slides, or transcripts into a clean RAG-indexed Markdown graph.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <form
              onSubmit={handleIngest}
              className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 space-y-6"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ingestion Inflow</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                    Subject Name
                  </label>
                  <CustomDropdown
                    options={subjectOptions}
                    value={subject}
                    onChange={setSubject}
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Topic / Document Title
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Mughal Architecture, Photosynthesis"
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                </div>
              </div>

              <div className="flex border-b border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("file")}
                  className={`flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                    activeTab === "file"
                      ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  PDF, DOCX or Image
                </button>
                
                <button
                  type="button"
                  onClick={() => setActiveTab("youtube")}
                  className={`flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                    activeTab === "youtube"
                      ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Video className="h-4 w-4" />
                  YouTube Link
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("paste")}
                  className={`flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                    activeTab === "paste"
                      ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  Paste Text
                </button>
              </div>

              <div className="min-h-36 flex flex-col justify-center">
                {activeTab === "file" && (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 bg-slate-50/50 dark:bg-[#151c2f]/20 hover:bg-slate-50 dark:hover:bg-[#151c2f]/45 transition duration-150 relative cursor-pointer group">
                    <input
                      type="file"
                      accept=".pdf,.docx,image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="h-10 w-10 text-slate-400 group-hover:text-indigo-500 transition duration-150 mb-3" />
                    {selectedFile ? (
                      <div className="text-center">
                        <span className="font-bold text-sm text-indigo-500 dark:text-indigo-400 block">{selectedFile.name}</span>
                        <span className="text-xs text-slate-400 mt-1 block">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to replace file</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <span className="font-bold text-sm text-slate-600 dark:text-slate-300 block">Drag & drop or select a file</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">Supports PDF, Word (.docx), or JPG/PNG (OCR)</span>
                        <span className="text-[10px] text-indigo-400/70 dark:text-indigo-500/60 mt-1 block">Maximum: {MAX_UPLOAD_SIZE_MB} MB • Optimal under 10 MB (~{MAX_INGEST_CHARS.toLocaleString()} chars)</span>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "youtube" && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-500">YouTube Video URL</span>
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition w-full"
                    />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal mt-1">
                      We will extract and parse English captions to create revision notes. If scraping fails due to video controls, use the &apos;Paste Text&apos; tab.
                    </span>
                  </div>
                )}

                {activeTab === "paste" && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-500">Paste Study Notes / Transcripts</span>
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      rows={5}
                      placeholder="Paste textbook segments, transcript logs, or summaries here..."
                      className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition w-full resize-none font-mono"
                    />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">
                        {pastedText.length.toLocaleString()} / {MAX_INGEST_CHARS.toLocaleString()} characters
                      </span>
                      {pastedText.length > SOFT_WARN_CHARS && pastedText.length < MAX_INGEST_CHARS && (
                        <span className="text-amber-500 font-medium">⚠ Approaching limit</span>
                      )}
                      {pastedText.length >= MAX_INGEST_CHARS && (
                        <span className="text-rose-500 font-bold">✕ Limit reached — please shorten</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal mt-1">
                      For best AI note quality, keep pasted text under {SOFT_WARN_CHARS.toLocaleString()} characters (~25 pages). Max: {MAX_INGEST_CHARS.toLocaleString()}.
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {status !== "idle" && status !== "success" && status !== "error" ? (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                    <span>
                      {status === "uploading" && "Reading document contents..."}
                      {status === "ocr_extracting" && "Extracting text from scan / captions..."}
                      {status === "formatting" && "LangGraph: analyzing structure & formatting notes..."}
                      {status === "indexing" && "Saving subtopic chunks to knowledge base..."}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <BookOpen className="h-4 w-4 text-emerald-500" />
                    Ready for master compilation.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status !== "idle" && status !== "success" && status !== "error"}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 transition ml-auto"
                >
                  Start Ingestion <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>

            {status !== "idle" && (
              <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Loader2 className={`h-4 w-4 text-indigo-500 ${status === "uploading" || status === "ocr_extracting" || status === "formatting" || status === "indexing" ? "animate-spin" : ""}`} />
                      Ingestion Inflow Pipeline
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Real-time execution map of AI ingestion graph nodes
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {status === "success" ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                        Pipeline Success
                      </span>
                    ) : status === "error" ? (
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 dark:text-rose-400 text-[10px] font-bold uppercase tracking-wider">
                        Pipeline Halted
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                        Active Processing
                      </span>
                    )}
                  </div>
                </div>

                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes pulse-amber {
                    0%, 100% {
                      transform: scale(1);
                      box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
                    }
                    50% {
                      transform: scale(1.08);
                      box-shadow: 0 0 0 6px rgba(245, 158, 11, 0);
                    }
                  }
                  @keyframes pulse-emerald {
                    0%, 100% {
                      transform: scale(1);
                      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
                    }
                    50% {
                      transform: scale(1.04);
                      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
                    }
                  }
                  @keyframes glow-line-slide {
                    0% {
                      background-position: 0% 0%;
                    }
                    100% {
                      background-position: 0% -200%;
                    }
                  }
                  .animate-pulse-amber {
                    animation: pulse-amber 1.8s infinite ease-in-out;
                  }
                  .animate-pulse-emerald {
                    animation: pulse-emerald 2.2s infinite ease-in-out;
                  }
                  .glowing-line-active {
                    background: linear-gradient(to bottom, #10b981, #f59e0b, #64748b, #10b981);
                    background-size: 100% 200%;
                    animation: glow-line-slide 1.5s infinite linear;
                  }
                `}} />

                <div className="space-y-0 pl-1 select-none">
                  {pipelineNodes.map((node, idx) => {
                    const isPending = node.status === "pending";
                    const isProcessing = node.status === "processing";
                    const isSuccess = node.status === "success";
                    const isFailed = node.status === "failed";
                    
                    return (
                      <div key={node.id} className="relative pl-10 pb-8 last:pb-2 group text-left">
                        {idx < pipelineNodes.length - 1 && (
                          <div className={`absolute left-[15px] top-[30px] bottom-0 w-[2px] rounded-full transition-all duration-500 ${getLineClass(idx)}`} />
                        )}

                        <div className={`absolute left-0 top-0 h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 z-10 ${
                          isSuccess 
                            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-500 dark:text-emerald-400 animate-pulse-emerald" 
                            : isProcessing
                            ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500 text-amber-500 dark:text-amber-400 animate-pulse-amber"
                            : isFailed
                            ? "bg-rose-50 dark:bg-rose-950/20 border-rose-500 text-rose-500 dark:text-rose-400"
                            : "bg-slate-100 dark:bg-[#151c2f] border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600"
                        }`}>
                          {isSuccess ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                          ) : isFailed ? (
                            <XCircle className="h-4 w-4 text-rose-500" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                          )}
                        </div>

                        <div className="flex flex-col text-left transition-all duration-300">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold transition-colors duration-300 ${
                              isPending 
                                ? "text-slate-400 dark:text-slate-600" 
                                : isFailed 
                                ? "text-rose-600 dark:text-rose-400"
                                : isProcessing
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-slate-800 dark:text-slate-200"
                            }`}>
                              {node.label}
                            </span>

                            {isProcessing && (
                              <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold animate-pulse uppercase tracking-wider">
                                Processing
                              </span>
                            )}
                            {isSuccess && (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                                Completed
                              </span>
                            )}
                            {isFailed && (
                              <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                                Halted
                              </span>
                            )}
                          </div>
                          
                          <span className={`text-xs mt-1 transition-colors duration-300 ${
                            isPending ? "text-slate-400/60 dark:text-slate-700" : "text-slate-500 dark:text-slate-400"
                          }`}>
                            {node.description}
                          </span>

                          {isFailed && errorMessage && (
                            <div className="mt-3 p-4 rounded-xl bg-slate-900 border border-slate-800 text-left font-mono text-xs text-rose-400 shadow-inner overflow-x-auto max-w-full animate-in slide-in-from-top-2 duration-300">
                              <div className="flex items-center gap-2 mb-2 text-rose-500 border-b border-slate-800 pb-1.5 font-bold uppercase tracking-wider text-[10px]">
                                <AlertCircle className="h-3.5 w-3.5" /> Pipeline Diagnostic Report
                              </div>
                              <div className="whitespace-pre-wrap leading-relaxed select-text font-semibold">
                                {`[ERROR] Ingestion process halted at node: "${node.label}"\n[REASON] ${errorMessage}`}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {status === "error" && !pipelineNodes.some(n => n.status === "failed") && (
              <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3 text-sm text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                  <h4 className="font-bold">Ingestion Blocked</h4>
                  <p className="text-xs mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 relative min-h-72 flex flex-col justify-between">
              
              {status === "success" && ingestedResult ? (
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-500 font-bold mb-4 text-sm">
                      <CheckCircle2 className="h-5 w-5" /> Ingested Successfully
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="text-xs">
                        <span className="text-slate-400 block uppercase font-bold text-[9px]">Subject</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{ingestedResult.subject}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-slate-400 block uppercase font-bold text-[9px]">Main Topic</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{ingestedResult.topic}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-slate-400 block uppercase font-bold text-[9px]">Source Ledger</span>
                        <span className="font-medium text-slate-500 dark:text-slate-300 truncate block">{ingestedResult.source}</span>
                      </div>
                    </div>
                    
                    <h3 className="text-xs uppercase font-bold text-slate-400 mb-2">
                      Chapters Structured ({ingestedResult.sections.length})
                      {ingestedResult.subtopicCount && ingestedResult.subtopicCount > ingestedResult.sections.length && (
                        <span className="text-indigo-500 dark:text-indigo-400 ml-1">
                          • {ingestedResult.subtopicCount} Subtopics
                        </span>
                      )}
                    </h3>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {ingestedResult.sections.map((sec, idx) => (
                        <div key={idx} className="text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-200">
                          {sec.title}
                        </div>
                      ))}
                    </div>
                  </div>

                  <a
                    href={`/subject?subject=${encodeURIComponent(ingestedResult.subject)}`}
                    className="mt-6 w-full py-2.5 rounded-xl text-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    View Subject Binder <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : (
                <div className="my-auto text-center p-6">
                  <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <h3 className="font-bold text-sm text-slate-500">Live Ingest Status</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                    Once you ingest a file or transcript, the real-time AI parser will display chapters and structured syllabus sections here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
        </div>
      </div>
    </div>
  );
}
