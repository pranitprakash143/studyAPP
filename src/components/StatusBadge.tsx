"use client";

type Status = "success" | "error" | "warning" | "info" | "pending" | "processing";

interface StatusBadgeProps {
  status: Status;
  label?: string;
  pulse?: boolean;
}

const statusStyles: Record<Status, string> = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  error: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  info: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  pending: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

export default function StatusBadge({ status, label, pulse }: StatusBadgeProps) {
  const defaultLabels: Record<Status, string> = {
    success: "Success",
    error: "Error",
    warning: "Warning",
    info: "Info",
    pending: "Pending",
    processing: "Processing",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusStyles[status]} ${pulse ? "animate-pulse" : ""}`}
    >
      {pulse && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          status === "processing" ? "bg-amber-500" :
          status === "success" ? "bg-emerald-500" :
          status === "error" ? "bg-rose-500" :
          "bg-current"
        }`} />
      )}
      {label || defaultLabels[status]}
    </span>
  );
}
