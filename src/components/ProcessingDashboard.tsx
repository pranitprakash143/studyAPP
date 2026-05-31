"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Square,
  Clock,
  BarChart3,
} from "lucide-react";

export interface TaskInfo {
  task_id: string;
  subject: string;
  status: "pending" | "running" | "completed" | "completed_with_errors" | "failed" | "cancelled";
  progress: number;
  current_node: string | null;
  items_total: number;
  items_completed: number;
  current_item: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  cancel_requested: boolean;
}

const NODE_LABELS: Record<string, string> = {
  save_raw_clean: "Cleaning text",
  analyze_structure: "Analyzing document structure",
  semantic_split: "Splitting into semantic chunks",
  generate_toc: "Generating table of contents",
  semantic_tag: "Tagging chunks to topics",
  assemble_chapters: "Assembling chapters",
  format_chapters: "Formatting study notes",
  save_to_chroma: "Embedding & indexing into vector DB",
  compile_wiki_pages: "Compiling wiki pages",
};

const NODE_ORDER = [
  "save_raw_clean",
  "analyze_structure",
  "semantic_split",
  "generate_toc",
  "semantic_tag",
  "assemble_chapters",
  "format_chapters",
  "save_to_chroma",
  "compile_wiki_pages",
];

function getNodeIndex(nodeName: string | null): number {
  if (!nodeName) return -1;
  return NODE_ORDER.indexOf(nodeName);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export default function ProcessingDashboard() {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(fetchTasks, 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTasks]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  const activeTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "running"
  );
  const recentTasks = tasks.filter(
    (t) =>
      t.status === "completed" ||
      t.status === "completed_with_errors" ||
      t.status === "failed" ||
      t.status === "cancelled"
  );
  const showRecent = recentTasks.length > 0 && (!isOpen || activeTasks.length === 0);

  const handleCancel = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/cancel`, { method: "POST" });
      fetchTasks();
    } catch {
      // silently fail
    }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 rounded-full hover:bg-slate-50 dark:hover:bg-slate-900/50 transition cursor-pointer group"
        title="Processing Dashboard"
      >
        {activeTasks.length > 0 ? (
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
        ) : (
          <BarChart3 className="h-5 w-5" />
        )}
        {activeTasks.length > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white leading-none">
            {activeTasks.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-[420px] max-h-[580px] bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-2xl shadow-slate-900/10 dark:shadow-black/30 overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              Processing Tasks
              {activeTasks.length > 0 && (
                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">
                  {activeTasks.length} active
                </span>
              )}
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="overflow-y-auto max-h-[480px] p-4 space-y-4">
            {tasks.length === 0 && (
              <div className="text-center py-8">
                <BarChart3 className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No processing tasks yet
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Tasks appear when you upload documents for processing.
                </p>
              </div>
            )}

            {activeTasks.map((task) => (
              <ActiveTaskCard key={task.task_id} task={task} onCancel={handleCancel} />
            ))}

            {showRecent && (
              <>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Clock className="h-3 w-3" /> Recent
                  </h4>
                </div>
                {recentTasks.slice(0, 5).map((task) => (
                  <RecentTaskCard key={task.task_id} task={task} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveTaskCard({
  task,
  onCancel,
}: {
  task: TaskInfo;
  onCancel: (id: string) => void;
}) {
  const currentIdx = getNodeIndex(task.current_node);
  const progressPercent = Math.min(task.progress, 100);

  return (
    <div className="bg-slate-50 dark:bg-[#151c2f]/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800/60 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
            {task.subject}
          </span>
        </div>
        <button
          onClick={() => onCancel(task.task_id)}
          disabled={task.cancel_requested}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[10px] font-bold transition disabled:opacity-30 cursor-pointer shrink-0"
        >
          <Square className="h-3 w-3 fill-current" />
          {task.cancel_requested ? "Cancelling..." : "Abort"}
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            {task.current_node
              ? NODE_LABELS[task.current_node] || task.current_node
              : "Waiting..."}
          </span>
          <span className="text-slate-400 dark:text-slate-500 font-bold">
            {progressPercent}%
          </span>
        </div>
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressPercent}%`,
              background:
                "linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)",
            }}
          />
        </div>
      </div>

      {task.current_item && (
        <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
          <span className="font-medium">Item:</span>
          <span className="truncate">{task.current_item}</span>
        </div>
      )}

      {task.items_total > 1 && (
        <div className="text-[10px] text-slate-400 dark:text-slate-500">
          {task.items_completed}/{task.items_total} documents processed
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {NODE_ORDER.map((nodeId, idx) => {
          let status: "done" | "current" | "pending" | "error" = "pending";
          if (idx < currentIdx) status = "done";
          else if (idx === currentIdx) status = "current";
          if (task.status === "failed" && idx === currentIdx) status = "error";

          return (
            <div
              key={nodeId}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold leading-tight ${
                status === "done"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : status === "current"
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : status === "error"
                  ? "bg-rose-500/10 text-rose-500"
                  : "bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600"
              }`}
            >
              {status === "done" ? (
                <CheckCircle2 className="h-2.5 w-2.5" />
              ) : status === "current" ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : status === "error" ? (
                <XCircle className="h-2.5 w-2.5" />
              ) : (
                <div className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
              <span className="truncate max-w-[80px]">
                {NODE_LABELS[nodeId]?.split(" ")[0] || nodeId}
              </span>
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-slate-400 dark:text-slate-500 text-right">
        {formatTime(task.created_at)}
      </div>
    </div>
  );
}

function RecentTaskCard({ task }: { task: TaskInfo }) {
  const isSuccess = task.status === "completed";
  const isError =
    task.status === "failed" || task.status === "completed_with_errors";
  const isCancelled = task.status === "cancelled";

  return (
    <div className="flex items-start gap-3 py-2.5 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#151c2f]/30 transition cursor-default">
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
      ) : isError ? (
        <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
      ) : isCancelled ? (
        <XCircle className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500 mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
            {task.subject}
          </span>
          <span className="text-[9px] text-slate-400 dark:text-slate-500">
            {formatTime(task.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={`text-[10px] font-bold ${
              isSuccess
                ? "text-emerald-500"
                : isError
                ? "text-rose-500"
                : isCancelled
                ? "text-slate-400"
                : "text-indigo-500"
            }`}
          >
            {isSuccess
              ? "Completed"
              : isError
              ? "Failed"
              : isCancelled
              ? "Cancelled"
              : task.status}
          </span>
          {task.items_total > 0 && (
            <span className="text-[9px] text-slate-400 dark:text-slate-500">
              {task.items_completed}/{task.items_total} docs
            </span>
          )}
        </div>
        {task.error && (
          <p className="text-[9px] text-rose-500 mt-1 line-clamp-2 leading-relaxed font-medium">
            {task.error}
          </p>
        )}
      </div>
    </div>
  );
}
