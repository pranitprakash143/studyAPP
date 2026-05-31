"use client";

import { useState } from "react";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import ErrorAlert from "@/components/ErrorAlert";
import TabGroup from "@/components/TabGroup";
import {
  UploadCloud,
  Video,
  FileText,
  BookOpen,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { getAIHeaders, HARDCODED_SUBJECTS } from "@/lib/settings";
import CustomDropdown from "@/components/CustomDropdown";

const MAX_UPLOAD_SIZE_MB = 15;
const MAX_INGEST_CHARS = 80_000;
const SOFT_WARN_CHARS = 60_000;

type IngestionState = "idle" | "uploading" | "success" | "error";

export default function Upload() {
  const [activeTab, setActiveTab] = useState<"file" | "youtube" | "paste">("file");

  const tabs = [
    { id: "file", label: "PDF, DOCX or Image", icon: <FileText className="h-4 w-4" /> },
    { id: "youtube", label: "YouTube Link", icon: <Video className="h-4 w-4" /> },
    { id: "paste", label: "Paste Text", icon: <ClipboardList className="h-4 w-4" /> },
  ];

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
    entryId: string;
  } | null>(null);

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

  const handleIngest = async (e: React.FormEvent<HTMLFormElement>) => {
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
        setIngestedResult({
          subject: data.subject,
          topic: data.topic,
          source: data.source,
          entryId: data.entry_id,
        });
        setStatus("success");
        setSelectedFile(null);
        setYoutubeUrl("");
        setPastedText("");
      } else {
        setErrorMessage(data.error || "Ingestion encountered an error.");
        setStatus("error");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error. Ingestion failed.";
      setErrorMessage(msg);
      setStatus("error");
    }
  };

  return (
    <PageLayout maxWidth="5xl">
      <PageHeader
        icon={<UploadCloud className="h-6 w-6" />}
        title="Ingest Syllabus Material"
        description="Process syllabus documents, handwritten notes, slides, or transcripts into a clean RAG-indexed Markdown graph."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleIngest} className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 space-y-6">
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

            <TabGroup tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as "file" | "youtube" | "paste")} />

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
                {status === "uploading" ? (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                    <span>Reading document contents...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <BookOpen className="h-4 w-4 text-emerald-500" />
                    Ready for master compilation.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "uploading"}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 transition ml-auto"
                >
                  Start Ingestion <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>

          {status === "error" && errorMessage && (
            <ErrorAlert title="Ingestion Failed" message={errorMessage} />
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 relative min-h-72 flex flex-col justify-between">

            {status === "success" && ingestedResult ? (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-emerald-500 font-bold mb-4 text-sm">
                    <CheckCircle2 className="h-5 w-5" /> Document Parsed
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="text-xs">
                      <span className="text-slate-400 block uppercase font-bold text-[9px]">Subject</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{ingestedResult.subject}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-400 block uppercase font-bold text-[9px]">Topic</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{ingestedResult.topic}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-400 block uppercase font-bold text-[9px]">Source</span>
                      <span className="font-medium text-slate-500 dark:text-slate-300 truncate block">{ingestedResult.source}</span>
                    </div>
                  </div>

                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-4">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                      Your document has been parsed and queued. Heavy processing (vector embeddings, wiki compilation) will happen when you visit the subject page.
                    </p>
                  </div>
                </div>

                <a
                  href={`/subject?subject=${encodeURIComponent(ingestedResult.subject)}`}
                  className="mt-2 w-full py-2.5 rounded-xl text-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  View Subject Binder <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <div className="my-auto text-center p-6">
                <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h3 className="font-bold text-sm text-slate-500">Live Ingest Status</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                  Once you ingest a file or transcript, it will be queued for AI processing, visible when you visit the subject page.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
