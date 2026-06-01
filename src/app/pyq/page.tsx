"use client";

import { useState } from "react";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import {
  BarChart2,
  FileText,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  Loader2,
  BookOpen,
  ArrowRight,
  Sparkles,
  Download,
  Search,
} from "lucide-react";
import { getAIHeaders, HARDCODED_SUBJECTS } from "@/lib/settings";
import CustomDropdown from "@/components/CustomDropdown";

interface PYQTopic {
  name: string;
  importance: "High" | "Medium" | "Low";
  sampleQuestion: string;
  coveredInKb: boolean;
}

type IngestStatus = "idle" | "uploading" | "ocr" | "compiling" | "extracted" | "error";
type AnalyzeStatus = "idle" | "loading" | "analyzed" | "error";

export default function PYQAnalysis() {
  const [activeWorkflow, setActiveWorkflow] = useState<"extract" | "gap">("extract");

  const subjectOptions = HARDCODED_SUBJECTS.map((sub) => ({
    value: sub,
    label: sub,
    icon: "📚",
  }));
  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");
  
  // Ingestion states
  const [subject, setSubject] = useState(HARDCODED_SUBJECTS[0]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedQuestions, setPastedQuestions] = useState("");
  const [ingestStatus, setIngestStatus] = useState<IngestStatus>("idle");
  const [ingestError, setIngestError] = useState("");
  const [extractedMarkdown, setExtractedMarkdown] = useState("");
  const [extractedSource, setExtractedSource] = useState("");

  // Analysis states
  const [analysisSubject, setAnalysisSubject] = useState(HARDCODED_SUBJECTS[0]);
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>("idle");
  const [analyzeError, setAnalyzeError] = useState("");
  const [analyzedTopics, setAnalyzedTopics] = useState<PYQTopic[]>([]);
  const [totalExtracted, setTotalExtracted] = useState(0);
  const [uncoveredCount, setUncoveredCount] = useState(0);

  // Auto-generation states per topic
  const [generatingTopic, setGeneratingTopic] = useState<Record<string, boolean>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Stage 1: Process Ingestion and Q&A Extraction
  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setIngestError("Please enter the subject name.");
      setIngestStatus("error");
      return;
    }
    if (activeTab === "file" && !selectedFile) {
      setIngestError("Please upload a PYQ paper PDF or scanned image first.");
      setIngestStatus("error");
      return;
    }
    if (activeTab === "paste" && !pastedQuestions.trim()) {
      setIngestError("Please paste the exam questions first.");
      setIngestStatus("error");
      return;
    }

    setIngestStatus("uploading");
    setIngestError("");
    setExtractedMarkdown("");

    const formData = new FormData();
    formData.append("subject", subject.trim());
    
    if (activeTab === "file" && selectedFile) {
      formData.append("file", selectedFile);
      if (selectedFile.type.startsWith("image/")) {
        setIngestStatus("ocr");
      }
    } else {
      formData.append("pastedQuestions", pastedQuestions);
    }

    try {
      if (ingestStatus !== "ocr") {
        setIngestStatus("compiling");
      }
      const res = await fetch("/api/pyq", {
        method: "POST",
        headers: getAIHeaders(),
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setExtractedMarkdown(data.markdown);
        setExtractedSource(data.source);
        setIngestStatus("extracted");
        // Pre-fill the analysis subject input to create a smooth transition
        setAnalysisSubject(subject.trim());
      } else {
        setIngestError(data.error || "Failed to extract and format questions.");
        setIngestStatus("error");
      }
    } catch (err: any) {
      setIngestError(err.message || "Failed to contact extraction endpoint.");
      setIngestStatus("error");
    }
  };

  // Stage 2: Load and Cross-Reference Syllabus Gaps
  const handleAnalyzeGaps = async (e?: React.FormEvent, targetSubject?: string) => {
    if (e) e.preventDefault();
    
    const subjectToQuery = targetSubject || analysisSubject;
    if (!subjectToQuery.trim()) {
      setAnalyzeError("Please enter the subject name to analyze.");
      setAnalyzeStatus("error");
      return;
    }

    setAnalyzeStatus("loading");
    setAnalyzeError("");
    setAnalyzedTopics([]);

    try {
      const res = await fetch("/api/pyq/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({ subject: subjectToQuery.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAnalyzedTopics(data.topics);
        setTotalExtracted(data.totalExtractedTopics);
        setUncoveredCount(data.uncoveredTopicsCount);
        setAnalyzeStatus("analyzed");
      } else {
        setAnalyzeError(data.error || "Failed to run syllabus gap analysis.");
        setAnalyzeStatus("error");
      }
    } catch (err: any) {
      setAnalyzeError(err.message || "Failed to cross-reference study library.");
      setAnalyzeStatus("error");
    }
  };

  // Stage 2: Patch Gaps by Auto-Generating notes and appending them to Master KB
  const handleAutoGenerateNotes = async (topicName: string) => {
    setGeneratingTopic({ ...generatingTopic, [topicName]: true });

    try {
      const targetSubject = analysisSubject || subject || "General Studies";
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          query: `Synthesize detailed high-yield revision notes for this specific exam topic: "${topicName}"`,
          subjectFilter: targetSubject,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Save the newly generated summary to the Master Knowledge Base!
        const ingestRes = await fetch("/api/ingest", {
          method: "POST",
          headers: getAIHeaders(),
          body: new URLSearchParams({
            subject: targetSubject,
            topic: topicName,
            pastedText: data.notes,
          }),
        });

        if (ingestRes.ok) {
          // Instantly toggle the coveredInKb state in the UI table!
          setAnalyzedTopics(prev =>
            prev.map(t => (t.name === topicName ? { ...t, coveredInKb: true } : t))
          );
          setUncoveredCount(prev => Math.max(prev - 1, 0));
        }
      }
    } catch (e) {
      console.error("Auto-generation of notes failed:", e);
    } finally {
      setGeneratingTopic(prev => ({ ...prev, [topicName]: false }));
    }
  };

  const handleDownloadMarkdown = () => {
    if (!extractedMarkdown) return;
    const blob = new Blob([extractedMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${subject.toLowerCase().replace(/\s+/g, "_")}_pyqs.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestartExtraction = () => {
    setSelectedFile(null);
    setPastedQuestions("");
    setExtractedMarkdown("");
    setIngestStatus("idle");
  };

  const handleQuickTransitionToGapAnalysis = () => {
    setAnalysisSubject(subject);
    setActiveWorkflow("gap");
    handleAnalyzeGaps(undefined, subject);
  };

  return (
    <PageLayout maxWidth="6xl">
      <PageHeader
        icon={<BarChart2 className="h-6 w-6" />}
        title="Exam Papers & Syllabus Gap Analysis"
        description="Upload past year questions to build your study banks, then scan for coverage gaps in your master library notes."
      />

        {/* Modular Workflow Switcher (Stage 1 vs. Stage 2) */}
        <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 mb-8 max-w-lg">
          <button
            onClick={() => setActiveWorkflow("extract")}
            className={`py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2.5 transition-all duration-200 ${
              activeWorkflow === "extract"
                ? "bg-white dark:bg-[#111726] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/30 dark:border-slate-800/40"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <FileText className="h-4.5 w-4.5" />
            1. Ingest & Extract Q&As
          </button>
          <button
            onClick={() => setActiveWorkflow("gap")}
            className={`py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2.5 transition-all duration-200 ${
              activeWorkflow === "gap"
                ? "bg-white dark:bg-[#111726] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/30 dark:border-slate-800/40"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Search className="h-4.5 w-4.5" />
            2. Analyze Syllabus Gaps
          </button>
        </div>

        {/* STAGE 1: Ingest & Extract Questions */}
        {activeWorkflow === "extract" && (
          <div className="space-y-6">
            {ingestStatus === "idle" || ingestStatus === "error" ? (
              <form
                onSubmit={handleExtract}
                className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md p-6 max-w-3xl mx-auto space-y-6"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <UploadCloud className="h-5 w-5 text-indigo-500" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ingest Exam Paper</h2>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">Target Subject</label>
                  <CustomDropdown
                    options={subjectOptions}
                    value={subject}
                    onChange={setSubject}
                  />
                </div>

                {/* File vs Paste Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab("file")}
                    className={`flex-1 pb-3 text-sm font-extrabold flex items-center justify-center gap-2 border-b-2 transition-all ${
                      activeTab === "file"
                        ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    PDF or Paper Scans
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("paste")}
                    className={`flex-1 pb-3 text-sm font-extrabold flex items-center justify-center gap-2 border-b-2 transition-all ${
                      activeTab === "paste"
                        ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    Paste Questions Text
                  </button>
                </div>

                <div className="min-h-36 flex flex-col justify-center">
                  {activeTab === "file" ? (
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 bg-slate-50/50 dark:bg-[#151c2f]/10 hover:bg-slate-50 dark:hover:bg-[#151c2f]/20 transition duration-150 relative cursor-pointer group">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <UploadCloud className="h-10 w-10 text-slate-400 group-hover:text-indigo-500 transition duration-150 mb-3" />
                      {selectedFile ? (
                        <div className="text-center">
                          <span className="font-extrabold text-sm text-indigo-500 dark:text-indigo-400 block">{selectedFile.name}</span>
                          <span className="text-xs text-slate-400 mt-1 block">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to replace file</span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="font-bold text-sm text-slate-600 dark:text-slate-300 block">Drag & drop or select a file</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">Supports PDF syllabus papers or Scanned PNG/JPG camera photos</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Paste Question Sheet Text</span>
                      <textarea
                        value={pastedQuestions}
                        onChange={(e) => setPastedQuestions(e.target.value)}
                        rows={6}
                        placeholder="Paste exam questions here (e.g. Q1. Discuss the core causes of...)"
                        className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition w-full resize-none font-mono text-slate-800 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                {ingestStatus === "error" && (
                  <div className="p-4 bg-rose-500/5 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-2">
                    <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                    {ingestError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md shadow-indigo-500/10 flex items-center justify-center gap-2 transition"
                >
                  Parse & Extract Q&As <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : ingestStatus !== "extracted" ? (
              /* Loading Screen */
              <div className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md p-12 text-center flex flex-col items-center gap-4 max-w-xl mx-auto w-full">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Extracting Questions & Answers...</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                  {ingestStatus === "uploading" && "Reading document contents..."}
                  {ingestStatus === "ocr" && "Processing page image via high-accuracy handwriting OCR..."}
                  {ingestStatus === "compiling" && "AI structuring questions and generating answers into Markdown..."}
                </p>
              </div>
            ) : (
              /* Success / Result Screen (Shows clean extracted Q&As) */
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="bg-white/90 dark:bg-[#111726]/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-lg text-slate-900 dark:text-white">Q&As Extracted Successfully!</h2>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Questions and suggested answers are structured and appended to your <strong>{subject}</strong> PYQ folder.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleDownloadMarkdown}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 flex items-center gap-2 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download MD
                    </button>
                    <button
                      onClick={handleRestartExtraction}
                      className="px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900 text-xs font-bold text-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition"
                    >
                      Ingest New Paper
                    </button>
                  </div>
                </div>

                {/* Beautiful Rendered Markdown display */}
                <div className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 overflow-hidden">
                  <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">Extracted Markdown Document</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">Source: {extractedSource}</span>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto text-sm text-slate-800 dark:text-slate-200 prose dark:prose-invert prose-indigo max-w-none font-mono bg-slate-50/50 dark:bg-slate-950/40 p-5 rounded-xl border border-slate-100 dark:border-slate-900 leading-relaxed whitespace-pre-wrap">
                    {extractedMarkdown}
                  </div>

                  {/* Call-to-action to check gaps! */}
                  <div className="mt-6 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Ready to scan your study materials for gaps in these questions?
                      </span>
                    </div>
                    <button
                      onClick={handleQuickTransitionToGapAnalysis}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                    >
                      Cross-Reference Gaps <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STAGE 2: Cross-Reference & Syllabus Gap Analysis */}
        {activeWorkflow === "gap" && (
          <div className="space-y-6">
            {/* Search Input Control */}
            <form
              onSubmit={(e) => handleAnalyzeGaps(e)}
              className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 flex flex-col sm:flex-row items-end gap-4 max-w-3xl mx-auto"
            >
              <div className="flex-1 flex flex-col gap-1.5 w-full">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-0.5">
                  <Search className="h-3.5 w-3.5 text-indigo-500" />
                  Select Subject to Analyze
                </label>
                <CustomDropdown
                  options={subjectOptions}
                  value={analysisSubject}
                  onChange={setAnalysisSubject}
                />
              </div>

              <button
                type="submit"
                disabled={analyzeStatus === "loading"}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-extrabold text-sm px-6 py-3 rounded-xl shadow-md shadow-indigo-500/5 shrink-0 flex items-center gap-2 transition w-full sm:w-auto justify-center"
              >
                {analyzeStatus === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyzing Gaps...
                  </>
                ) : (
                  <>
                    Scan Library Gaps <Sparkles className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {analyzeStatus === "idle" && (
              <div className="bg-white/50 dark:bg-[#111726]/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-2xl mx-auto flex flex-col items-center gap-3">
                <BarChart2 className="h-10 w-10 text-slate-400" />
                <h3 className="font-extrabold text-slate-700 dark:text-slate-300">Run Gap Scan</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md leading-relaxed">
                  Enter the subject name above to compare your study notes (master copy) with the compiled past paper banks. We'll identify syllabus topics that are uncovered or missing.
                </p>
              </div>
            )}

            {analyzeStatus === "error" && (
              <div className="bg-white/85 dark:bg-[#111726]/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-2xl mx-auto space-y-4">
                <div className="p-4 bg-rose-500/5 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                  {analyzeError}
                </div>
                <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Have you compiled past papers for this subject yet? Go to step 1 to build your Q&A repository first.
                  </p>
                  <button
                    onClick={() => setActiveWorkflow("extract")}
                    className="px-4 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 font-extrabold text-xs transition"
                  >
                    Extract Past Paper Questions
                  </button>
                </div>
              </div>
            )}

            {analyzeStatus === "analyzed" && (
              <div className="space-y-6">
                {/* Metrics */}
                <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/85 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                      <BarChart2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-lg text-slate-900 dark:text-white">Distilled Syllabus Topics ({totalExtracted})</h2>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Cross-referenced against your master revision study sheets.
                      </p>
                    </div>
                  </div>

                  <div className="px-5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#151c2f]/40 border border-slate-100 dark:border-slate-800 text-center shrink-0">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-extrabold">Missing Syllabus Gaps</span>
                    <span className="text-xl font-extrabold text-rose-500 mt-0.5 block">{uncoveredCount}</span>
                  </div>
                </div>

                {/* Table Gap Matrix */}
                <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/85 shadow-sm p-6 overflow-hidden">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4">Syllabus Topic Analysis Matrix</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          <th className="pb-3 font-semibold">Distilled Syllabus Concept</th>
                          <th className="pb-3 font-semibold w-32">Importance</th>
                          <th className="pb-3 font-semibold w-40">Coverage Status</th>
                          <th className="pb-3 font-semibold w-48 text-right">Adaptive Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {analyzedTopics.map((topic, index) => (
                          <tr key={index} className="group hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                            <td className="py-4 pr-4">
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 block text-sm">{topic.name}</span>
                              <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block italic leading-relaxed">"{topic.sampleQuestion}"</span>
                            </td>
                            <td className="py-4">
                              <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                topic.importance === "High"
                                  ? "bg-rose-500/10 text-rose-500"
                                  : topic.importance === "Medium"
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                              }`}>
                                {topic.importance}
                              </span>
                            </td>
                            <td className="py-4">
                              {topic.coveredInKb ? (
                                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                                  <CheckCircle className="h-4 w-4 shrink-0" /> In Library
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-xs font-bold text-rose-500">
                                  <AlertTriangle className="h-4 w-4 shrink-0" /> Missing Gap
                                </span>
                              )}
                            </td>
                            <td className="py-4 text-right">
                              {topic.coveredInKb ? (
                                <a
                                  href={`/notes?subject=${encodeURIComponent(analysisSubject || "General Studies")}`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition"
                                >
                                  View Notes <BookOpen className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                <button
                                  onClick={() => handleAutoGenerateNotes(topic.name)}
                                  disabled={generatingTopic[topic.name]}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-500 text-xs font-bold transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
                                >
                                  {generatingTopic[topic.name] ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Patching...
                                    </>
                                  ) : (
                                    <>
                                      Auto-Generate <Sparkles className="h-3.5 w-3.5" />
                                    </>
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
    </PageLayout>
  );
}
