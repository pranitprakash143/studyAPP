"use client";

import { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

interface PageLayoutProps {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
}

const maxWidthClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export default function PageLayout({ children, maxWidth = "7xl" }: PageLayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0b0f19]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <div className="flex-1 overflow-y-auto">
          <main className={`p-8 ${maxWidthClasses[maxWidth]} mx-auto`}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
