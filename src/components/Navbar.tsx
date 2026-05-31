"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Sparkles, User, Database } from "lucide-react";
import { useAIConfig } from "@/contexts/AIConfigContext";
import ProcessingDashboard from "@/components/ProcessingDashboard";

interface Stats {
  totalSubjects: number;
  totalSources: number;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { aiHeaders } = useAIConfig();
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/notes", {
          method: "GET",
          headers: aiHeaders,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.stats) {
            setStats({
              totalSubjects: data.stats.totalSubjects,
              totalSources: data.stats.totalSources,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load navbar stats:", err);
      }
    }
    fetchStats();
  }, []);

  // Map route pathnames to friendly names for breadcrumbs
  const getBreadcrumbs = () => {
    const paths = pathname.split("/").filter((x) => x);
    if (paths.length === 0) {
      return [
        { name: "PrepAgent", href: "/" },
        { name: "Dashboard", href: "/" }
      ];
    }

    const breadcrumbs = [{ name: "PrepAgent", href: "/" }];
    
    let currentHref = "";
    paths.forEach((path, idx) => {
      currentHref += `/${path}`;
      let name = path.charAt(0).toUpperCase() + path.slice(1);
      
      // Friendly names mapping
      if (path === "library") name = "Study Library";
      if (path === "upload") name = "Upload Materials";
      if (path === "notes") name = "Study Notes";
      if (path === "quiz") name = "Quiz Engine";
      if (path === "socratic") name = "Socratic Coach";
      if (path === "pyq") name = "PYQ Analysis";
      if (path === "settings") name = "Settings";
      if (path === "subject") name = "Subject View";

      breadcrumbs.push({ name, href: currentHref });
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/library?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 border-b border-slate-200/50 bg-white/75 dark:border-slate-800/50 dark:bg-[#0b0f19]/75 backdrop-blur-md transition-colors duration-200">
      <div className="flex h-full items-center justify-between px-6 md:px-8">
        
        {/* Left Section: Breadcrumbs */}
        <div className="flex items-center space-x-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {breadcrumbs.map((crumb, idx) => (
            <div key={`${crumb.href}-${idx}`} className="flex items-center">
              {idx > 0 && <span className="mx-2 text-slate-300 dark:text-slate-700">/</span>}
              <span
                onClick={() => router.push(crumb.href)}
                className={`cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${
                  idx === breadcrumbs.length - 1
                    ? "font-semibold text-slate-900 dark:text-white pointer-events-none"
                    : ""
                }`}
              >
                {crumb.name}
              </span>
            </div>
          ))}
        </div>

        {/* Center Section: Conceptual Search Bar */}
        <form 
          onSubmit={handleSearchSubmit} 
          className={`hidden md:flex items-center max-w-md w-full mx-4 transition-all duration-300 relative ${
            searchFocused ? "scale-[1.02]" : ""
          }`}
        >
          <div className="relative w-full">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${
              searchFocused ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
            }`} />
            <input
              type="text"
              placeholder="Search syllabus & study library..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full h-10 pl-10 pr-12 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111726]/50 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white dark:focus:bg-[#111726] transition-all duration-200"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center space-x-0.5 select-none pointer-events-none">
              <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182032] px-1.5 font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 shadow-sm">
                <span>⌘</span>
                <span>K</span>
              </kbd>
            </div>
          </div>
        </form>

        {/* Right Section: Revision stats Badge & User Profile */}
        <div className="flex items-center space-x-4">
          
          {/* Live Ingestion Stats */}
          {stats && (
            <div className="hidden lg:flex items-center space-x-2.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#111726]/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="flex items-center space-x-1">
                <Database className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>{stats.totalSubjects} {stats.totalSubjects === 1 ? 'Subject' : 'Subjects'}</span>
              </div>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <div className="flex items-center space-x-1">
                <Sparkles className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
                <span>{stats.totalSources} Topics</span>
              </div>
            </div>
          )}

          <ProcessingDashboard />

          {/* Premium Profile Avatar & Glow */}
          <div className="flex items-center space-x-3 pl-2 border-l border-slate-200/60 dark:border-slate-800/60">
            <div className="relative group cursor-pointer select-none">
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 opacity-75 blur-[2px] transition group-hover:opacity-100 duration-200" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-[#1a233a] font-bold text-xs shadow-sm">
                PP
              </div>
              {/* Online indicator */}
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0b0f19]" />
            </div>
            
            <div className="hidden sm:flex flex-col text-left select-none pointer-events-none">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none">Pranit Prakash</span>
              <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 leading-none mt-0.5">Premium Scholar</span>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
}
