"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import {
  GraduationCap,
  BookOpen,
  FileText,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  Search,
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

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0b0f19]">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        
        <div className="flex-1 overflow-y-auto">
          <main className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome back to PrepAgent
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Your offline-first intelligent workspace for syllabi, notes, and MCQ quizzes.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] text-slate-500 dark:text-indigo-400">
            <BrainCircuit className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            RAG Ingestion Active
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-[#111726] p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-300" />
            <BookOpen className="h-6 w-6 text-indigo-500 mb-4" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block">Total Subjects</span>
            <span className="text-3xl font-bold text-slate-900 dark:text-white mt-1 block">
              {loading ? "..." : stats?.totalSubjects || 0}
            </span>
          </div>

          <div className="bg-white dark:bg-[#111726] p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-300" />
            <FileText className="h-6 w-6 text-cyan-500 mb-4" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block">Source Documents</span>
            <span className="text-3xl font-bold text-slate-900 dark:text-white mt-1 block">
              {loading ? "..." : stats?.totalSources || 0}
            </span>
          </div>

          <div className="bg-white dark:bg-[#111726] p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-300" />
            <TrendingUp className="h-6 w-6 text-emerald-500 mb-4" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block">Knowledge Chunks</span>
            <span className="text-3xl font-bold text-slate-900 dark:text-white mt-1 block">
              {loading ? "..." : stats?.totalChunks || 0}
            </span>
          </div>

          <div className="bg-white dark:bg-[#111726] p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 duration-300" />
            <BrainCircuit className="h-6 w-6 text-violet-500 mb-4" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block">Master KB Size</span>
            <span className="text-3xl font-bold text-slate-900 dark:text-white mt-1 block">
              {loading ? "..." : `${((stats?.masterKbSizeBytes || 0) / 1024).toFixed(1)} KB`}
            </span>
          </div>
        </div>

        {/* Dynamic Grid: Main & Side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Dashboard Section */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Intro & Get Started */}
            <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-2xl p-6 shadow-md shadow-indigo-500/10">
              <h2 className="text-xl font-bold mb-2">Build your structured Knowledge Graph</h2>
              <p className="text-indigo-50/90 text-sm leading-relaxed mb-6">
                Upload PDFs, notes, scanned pages, or YouTube syllabus videos. We'll extract the text, format it into clear Markdown, append it to your Master Knowledge Base file, and index it locally. Perfect for active recall studying!
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

            {/* Ingested Subjects Breakdown */}
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Ingested Subjects</h3>
              
              {loading ? (
                <div className="text-center py-8 text-slate-400">Loading course materials...</div>
              ) : !stats || stats.subjects.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <GraduationCap className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No subjects ingested yet.</p>
                  <Link href="/upload" className="text-xs text-indigo-500 font-semibold hover:underline mt-1 block">
                    Upload your first document to start
                  </Link>
                </div>
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
            </div>
          </div>

          {/* Sidebar Guidelines */}
          <div className="space-y-6">
            
            {/* Quick Actions */}
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 space-y-3">
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
            </div>

            {/* Strict Ingestion Rule Card */}
            <div className="bg-slate-100 dark:bg-[#111726] rounded-2xl p-6 border border-slate-200 dark:border-slate-800/80">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mb-3 text-sm">
                <HelpCircle className="h-5 w-5" />
                Anti-Hallucination Safe
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                PrepAgent runs a strict retrieval RAG pipeline. When generating study cards or quizzes, the AI is explicitly locked to your single source of truth—the master knowledge base. This keeps your study materials reliable and grounded in your syllabus!
              </p>
            </div>

            {/* Source Documents list */}
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6">
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
                      <span className="text-[10px] uppercase font-bold text-emerald-500 shrink-0">Indexed</span>
                    </div>
                  ))}
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
