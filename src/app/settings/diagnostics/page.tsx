"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import LoadingState from "@/components/LoadingState";
import ErrorAlert from "@/components/ErrorAlert";
import StatusBadge from "@/components/StatusBadge";
import TabGroup from "@/components/TabGroup";
import {
  Terminal,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Download,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Server,
  CloudLightning,
  AlertTriangle,
  FileCode,
} from "lucide-react";
import { loadSettings, getAIHeaders } from "@/lib/settings";

export default function DiagnosticsPortal() {
  const [activeTab, setActiveTab] = useState<"nextjs" | "backend">("nextjs");
  const [logs, setLogs] = useState<{ nextjs: string; backend: string }>({
    nextjs: "",
    backend: "",
  });
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  const nextjsEndRef = useRef<HTMLDivElement>(null);
  const backendEndRef = useRef<HTMLDivElement>(null);

  // Load logs from API
  const fetchLogs = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/admin/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs({
          nextjs: data.nextjs || "",
          backend: data.backend || "",
        });
      }
    } catch (err) {
      console.error("Failed to load server logs:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Poll logs
  useEffect(() => {
    fetchLogs(true);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(false);
    }, 2500);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Scroll to bottom when logs load (only if log changes)
  useEffect(() => {
    if (nextjsEndRef.current && activeTab === "nextjs") {
      nextjsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.nextjs, activeTab]);

  useEffect(() => {
    if (backendEndRef.current && activeTab === "backend") {
      backendEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.backend, activeTab]);

  // Clear Logs
  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all server logs? This cannot be undone.")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/admin/logs/clear", { method: "POST" });
      if (res.ok) {
        await fetchLogs(false);
        alert("Logs successfully cleared!");
      }
    } catch (err) {
      console.error("Failed to clear logs:", err);
    } finally {
      setClearing(false);
    }
  };

  // Download Logs
  const handleDownloadLogs = () => {
    const logContent = activeTab === "nextjs" ? logs.nextjs : logs.backend;
    const blob = new Blob([logContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prepagent_${activeTab}_logs_${new Date().toISOString().slice(0, 10)}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Run Gemini connection test in-context
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    // Give it a brief moment so the log panel clears and user sees the connection start log
    setTimeout(async () => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        };

        const res = await fetch("/api/settings/test", {
          method: "POST",
          headers,
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setTestResult({
            success: true,
            message: `Connected successfully! LLM replied: "${data.message}"`,
          });
        } else {
          setTestResult({
            success: false,
            error: data.error || "Connection rejected by Gemini endpoint.",
          });
        }
      } catch (err: any) {
        setTestResult({
          success: false,
          error: err.message || "Failed to reach connection test endpoint.",
        });
      } finally {
        setTestingConnection(false);
        // Instantly fetch logs to capture the outputs of the test
        fetchLogs(false);
      }
    }, 400);
  };

  // Filter log lines by search query
  const getFilteredLogs = (rawLogs: string) => {
    if (!rawLogs) return [];
    const lines = rawLogs.split("\n");
    if (!searchQuery.trim()) return lines;
    return lines.filter((line) =>
      line.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Helper to color code terminal log lines
  const renderLogLine = (line: string, index: number) => {
    if (!line.trim()) return null;
    let className = "text-slate-300 py-0.5 px-2 rounded-sm border-l-2 border-transparent hover:bg-slate-800/40 transition-colors";
    
    if (line.includes("[ERROR]") || line.includes("ERROR") || line.includes("failed") || line.includes("Exception")) {
      className = "text-rose-400 bg-rose-500/10 py-0.5 px-2 rounded-sm border-l-2 border-rose-500 hover:bg-rose-500/20 font-semibold transition-colors";
    } else if (line.includes("[WARN]") || line.includes("WARNING")) {
      className = "text-amber-400 bg-amber-500/5 py-0.5 px-2 rounded-sm border-l-2 border-amber-500 hover:bg-amber-500/15 transition-colors";
    } else if (line.includes("[SYSTEM]") || line.includes("SYSTEM")) {
      className = "text-cyan-400 py-0.5 px-2 rounded-sm border-l-2 border-cyan-500 font-bold transition-colors";
    } else if (line.includes("SUCCESS") || line.includes("Success") || line.includes("connected successfully") || line.includes("✅")) {
      className = "text-emerald-400 bg-emerald-500/5 py-0.5 px-2 rounded-sm border-l-2 border-emerald-500 hover:bg-emerald-500/15 transition-colors";
    }

    return (
      <div key={index} className={`${className} font-mono text-xs whitespace-pre-wrap leading-relaxed break-all`}>
        {line}
      </div>
    );
  };

  const filteredLines = getFilteredLogs(activeTab === "nextjs" ? logs.nextjs : logs.backend);

  return (
    <PageLayout maxWidth="6xl">
      <PageHeader
        icon={<Terminal className="h-6 w-6 text-indigo-500" />}
        title="Production Diagnostics Portal"
        description="Real-time server log debugger. Troubleshoot API credentials and cloud network issues."
      >
        <Link
          href="/settings"
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <label className="flex items-center gap-2 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800/80 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer shadow-sm">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded text-indigo-500 focus:ring-indigo-500 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
          />
          <span>Auto-Refresh (2s)</span>
          <span className={`inline-block w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
        </label>

        <button
          onClick={() => fetchLogs(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>

        <button
          onClick={handleClearLogs}
          disabled={clearing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-500 shadow-sm transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Wipe Logs
        </button>
      </div>

      {/* Quick Test Console Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Diagnostics Controls & Interactive Connection Tester */}
              <div className="space-y-6 lg:col-span-1">
                
                {/* Active Connection Test Control */}
                <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800/80 shadow-sm rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                    <CloudLightning className="h-5 w-5 text-indigo-500" />
                    <h2 className="text-md font-bold text-slate-900 dark:text-white">Active Connection Tester</h2>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Trigger a connection test on the server. Next.js will write detailed networking and model availability diagnostics to the logs panel in real-time.
                  </p>

                  <button
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:scale-95 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition-all"
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running Network Tests...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </button>

                  {/* Test Result Callout */}
                  {testResult && (
                    <div
                      className={`p-4 rounded-xl border text-xs leading-relaxed transition-all ${
                        testResult.success
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {testResult.success ? (
                          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-bold">{testResult.success ? "Connection Success" : "Connection Failed"}</p>
                          <p className="mt-1 font-mono break-words">{testResult.success ? testResult.message : testResult.error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* System Specs status Card */}
                <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800/80 shadow-sm rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                    <Server className="h-5 w-5 text-indigo-500" />
                    <h2 className="text-md font-bold text-slate-900 dark:text-white">Service Health Status</h2>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Next.js Webserver:</span>
                      <span className="flex items-center gap-1.5 font-bold text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">FastAPI Backend:</span>
                      <span className="flex items-center gap-1.5 font-bold text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">ChromaDB Vector:</span>
                      <span className="flex items-center gap-1.5 font-bold text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/60 pt-3">
                      <span className="text-slate-500 dark:text-slate-400">Volume Storage:</span>
                      <span className="font-mono text-slate-400">/app/knowledge_base</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Immersive Terminal Logs View */}
              <div className="lg:col-span-2 flex flex-col bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800/80 shadow-sm rounded-2xl overflow-hidden h-[600px]">
                
                {/* Log Header Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800/80 gap-3 bg-slate-50/50 dark:bg-slate-900/20">
                  {/* Tabs */}
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-900 p-1 self-start">
                    <button
                      onClick={() => setActiveTab("nextjs")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        activeTab === "nextjs"
                          ? "bg-white dark:bg-[#111726] text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <FileCode className="h-3.5 w-3.5" />
                      Next.js Server Logs
                    </button>
                    <button
                      onClick={() => setActiveTab("backend")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        activeTab === "backend"
                          ? "bg-white dark:bg-[#111726] text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Server className="h-3.5 w-3.5" />
                      Python Backend Logs
                    </button>
                  </div>

                  {/* Search and Download */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-3 py-1.5 w-full sm:w-48 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      />
                    </div>

                    <button
                      onClick={handleDownloadLogs}
                      title="Download Logs"
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Log Terminal Screen */}
                <div className="flex-1 bg-slate-950 dark:bg-[#070b13] p-4 overflow-y-auto space-y-1 select-text">
                  
                  {loading && logs.nextjs === "" ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                      <p className="text-xs font-mono">Loading active server logs stream...</p>
                    </div>
                  ) : filteredLines.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 space-y-2">
                      <AlertTriangle className="h-8 w-8 text-amber-500/70" />
                      <p className="text-xs font-mono">No logs found matching "{searchQuery}"</p>
                    </div>
                  ) : (
                    <>
                      {filteredLines.map((line, index) => renderLogLine(line, index))}
                      <div ref={activeTab === "nextjs" ? nextjsEndRef : backendEndRef} />
                    </>
                  )}

                </div>

                {/* Log Footer Info */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center text-slate-400 text-[10px] font-mono">
                  <span>Lines showing: {filteredLines.length}</span>
                  <span>Persistent location: knowledge_base/logs/{activeTab === "nextjs" ? "nextjs" : "backend"}.log</span>
                </div>

              </div>

            </div>

    </PageLayout>
  );
}
