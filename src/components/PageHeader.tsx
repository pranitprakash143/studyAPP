"use client";

import { ReactNode } from "react";

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function PageHeader({ icon, title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
          {icon}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          {description && (
            <p className="text-slate-500 dark:text-slate-400 mt-1">{description}</p>
          )}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
