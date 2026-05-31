"use client";

import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { icon: "h-6 w-6", text: "text-xs" },
  md: { icon: "h-10 w-10", text: "text-sm" },
  lg: { icon: "h-12 w-12", text: "text-base" },
};

export default function LoadingState({ message = "Loading...", size = "md" }: LoadingStateProps) {
  const s = sizeMap[size];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Loader2 className={`${s.icon} animate-spin text-indigo-500 mb-3`} />
      <span className={`${s.text} text-slate-500 dark:text-slate-400`}>{message}</span>
    </div>
  );
}
