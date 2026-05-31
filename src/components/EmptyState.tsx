"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      <div className="flex justify-center mb-3 text-slate-300 dark:text-slate-600">{icon}</div>
      <p className="font-semibold text-slate-600 dark:text-slate-400 text-sm">{title}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
