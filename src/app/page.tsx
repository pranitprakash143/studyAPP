"use client";

import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import {
  GraduationCap,
  BookOpen,
  FileText,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  Search,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { getAIHeaders } from "@/lib/settings";

interface Stats {
  totalSubjects: number;
  totalSources: number;
  totalChunks: number;
  masterKbSizeBytes: number;
  subjects: string[];
  sources: string[];
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
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
      } catch (err) {
        console.error("Failed to load dashboard statistics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const handleReset = async () => {
    setResetting(true);
    setResetResult(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setResetResult("success");
        setStats({ totalSubjects: 0, totalSources: 0, totalChunks: 0, masterKbSizeBytes: 0, subjects: [], sources: [] });
      } else {
        setResetResult("error");
      }
    } catch {
      setResetResult("error");
    } finally {
      setResetting(false);
      setShowResetConfirm(false);
      setTimeout(() => setResetResult(null), 4000);
    }
  };

  return (
    <PageLayout maxWidth="7xl">
      <PageHeader
        icon={<BrainCircuit className="h-6 w-6" />}
        title="Welcome back to PrepAgent"
        description="Your offline-first intelligent workspace for syllabi, notes, and MCQ quizzes."
      >
        <StatusBadge status="info" label="RAG Ingestion Active" pulse />
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-300" />
          <BookOpen className="h-6 w-6 text-indigo-500 mb-4" />
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block">Total Subjects</span>
          <span className="text-3xl font-bold text-slate-900 dark:text-white mt-1 block">
            {loading ? "..." : stats?.totalSubjects || 0}
          </span>
        </Card>

        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-300" />
          <FileText className="h-6 w-6 text-cyan-500 mb-4" />
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block">Source Documents</span>
          <span className="text-3xl font-bold text-slate-900 dark:text-white mt-1 block">
            {loading ? "..." : stats?.totalSources || 0}
          </span>
        </Card>

        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-300" />
          <TrendingUp className="h-6 w-6 text-emerald-500 mb-4" />
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block">Knowledge Chunks</span>
          <span className="text-3xl font-bold text-slate-900 dark:text-white mt-1 block">
            {loading ? "..." : stats?.totalChunks || 0}
          </span>
        </Card>

        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-300" />
          <BrainCircuit className="h-6 w-6 text-violet-500 mb-4" />
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block">Master KB Size</span>
          <span className="text-3xl font-bold text-slate-900 dark:text-white mt-1 block">
            {loading ? "..." : `${((stats?.masterKbSizeBytes || 0) / 1024).toFixed(1)} KB`}
          </span>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-2xl p-6 shadow-md shadow-indigo-500/10">
            <h2 className="text-xl font-bold mb-2">Build your structured Knowledge Graph</h2>
            <p className="text-indigo-50/90 text-sm leading-relaxed mb-6">
              Upload PDFs, notes, scanned pages, or YouTube syllabus videos. We&apos;ll extract the text, format it into clear Markdown, append it to your Master Knowledge Base file, and index it locally. Perfect for active recall studying!
            </p>
            <div className="flex gap-4">
              <Link
                href="/upload"
                className="bg-white text-indigo-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-sm"
              >
                Upload Material <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/notes"
                className="bg-indigo-600/30 hover:bg-indigo-600/50 border border-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition"
              >
                Explore Master KB
              </Link>
            </div>
          </div>

          <Card>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Ingested Subjects</h3>
            {loading ? (
              <LoadingState message="Loading course materials..." size="sm" />
            ) : !stats || stats.subjects.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="h-8 w-8" />}
                title="No subjects ingested yet."
                description="Upload your first document to start"
                action={
                  <Link href="/upload" className="text-xs text-indigo-500 font-semibold hover:underline mt-1 block">
                    Upload your first document to start
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.subjects.map((subject) => (
                  <Link
                    key={subject}
                    href={`/subject?subject=${encodeURIComponent(subject)}`}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#151c2f]/40 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-[#161d30] transition duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{subject}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Study Playbook</h3>
            <Link href="/quiz" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Start Active Recall Quiz</h4>
                <p className="text-xs text-slate-400 mt-0.5">Test yourself strictly on your files.</p>
              </div>
            </Link>
            <Link href="/pyq" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-500">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Analyze Exam Papers</h4>
                <p className="text-xs text-slate-400 mt-0.5">Extract core topics and find study gaps.</p>
              </div>
            </Link>
          </Card>

          <div className="bg-slate-100 dark:bg-[#111726] rounded-2xl p-6 border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mb-3 text-sm">
              <HelpCircle className="h-5 w-5" />
              Anti-Hallucination Safe
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
              PrepAgent runs a strict retrieval RAG pipeline. When generating study cards or quizzes, the AI is explicitly locked to your single source of truth—the master knowledge base. This keeps your study materials reliable and grounded in your syllabus!
            </p>
          </div>

          <Card>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Sources Ingested</h3>
            {loading ? (
              <p className="text-xs text-slate-400">Loading sources...</p>
            ) : !stats || stats.sources.length === 0 ? (
              <p className="text-xs text-slate-400">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {stats.sources.map((src) => (
                  <div key={src} className="text-xs flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#151c2f]/40 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800/40 truncate">
                    <span className="truncate pr-2 font-medium">{src}</span>
                    <StatusBadge status="success" label="Indexed" />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Reset / Danger Zone */}
          <Card className="border-rose-500/20">
            <div className="flex items-center gap-2 text-rose-500 font-bold mb-3 text-sm">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Wipe all ingested data, vector embeddings, wiki pages, and logs. Use this after syllabus changes or to start fresh.
            </p>
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={resetting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 font-semibold text-xs transition disabled:opacity-50"
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {resetting ? "Clearing All Data..." : "Reset All Data"}
            </button>
            {resetResult === "success" && (
              <p className="text-xs text-emerald-500 mt-2 text-center font-semibold">All data cleared successfully.</p>
            )}
            {resetResult === "error" && (
              <p className="text-xs text-rose-500 mt-2 text-center font-semibold">Reset failed. Check server logs.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-2xl p-6 max-w-sm mx-4 w-full">
            <div className="flex items-center gap-2 text-rose-500 font-bold text-sm mb-3">
              <AlertTriangle className="h-5 w-5" />
              Confirm Reset
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              This will permanently delete:
            </p>
            <ul className="text-xs text-slate-500 dark:text-slate-500 mb-4 space-y-1 list-disc pl-4">
              <li>All vector embeddings (ChromaDB)</li>
              <li>Master knowledge base file</li>
              <li>All wiki pages</li>
              <li>Highlights, mindmaps, and metadata</li>
              <li>Server logs</li>
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowResetConfirm(false); setResetResult(null); }}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resetting && <Loader2 className="h-4 w-4 animate-spin" />}
                {resetting ? "Resetting..." : "Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
