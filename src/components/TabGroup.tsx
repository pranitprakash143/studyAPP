"use client";

import { ReactNode } from "react";

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabGroupProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: "underline" | "pills";
}

export default function TabGroup({ tabs, activeTab, onChange, className = "", variant = "underline" }: TabGroupProps) {
  if (variant === "pills") {
    return (
      <div className={`flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 self-start ${className}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === tab.id
                ? "bg-white dark:bg-[#111726] text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex border-b border-slate-100 dark:border-slate-800 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === tab.id
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
