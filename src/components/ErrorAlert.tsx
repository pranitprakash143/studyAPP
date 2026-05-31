"use client";

import { AlertCircle } from "lucide-react";
import { ReactNode } from "react";

interface ErrorAlertProps {
  title?: string;
  message: string;
  children?: ReactNode;
}

export default function ErrorAlert({ title = "Error", message, children }: ErrorAlertProps) {
  return (
    <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3">
      <AlertCircle className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm text-rose-600 dark:text-rose-400">{title}</h4>
        <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-0.5">{message}</p>
        {children}
      </div>
    </div>
  );
}
