"use client";

import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export default function Card({ children, className = "", padding = "md" }: CardProps) {
  return (
    <div
      className={`bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
