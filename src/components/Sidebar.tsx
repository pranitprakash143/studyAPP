"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  GraduationCap,
  UploadCloud,
  BookOpen,
  Award,
  BarChart2,
  Settings as SettingsIcon,
  LayoutDashboard,
  MessageSquare,
  Database,
  ChevronLeft,
  ChevronRight,
  Palette,
  Network,
  Newspaper,
} from "lucide-react";
import { useAIConfig } from "@/contexts/AIConfigContext";
import CustomDropdown from "@/components/CustomDropdown";

export default function Sidebar() {
  const pathname = usePathname();
  const { settings, updateSettings } = useAIConfig();
  const theme = settings.theme;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const themes = [
    { value: "theme-dark" as const, label: "Obsidian Dark", icon: "🌙" },
    { value: "theme-light" as const, label: "Ivory Light", icon: "☀️" },
    { value: "theme-sepia" as const, label: "Warm Sepia", icon: "📜" },
    { value: "theme-forest" as const, label: "Pine Forest", icon: "🌲" },
    { value: "theme-ocean" as const, label: "Deep Ocean", icon: "🌊" },
  ];

  useEffect(() => {
    // Load collapsible state
    const collapsed = localStorage.getItem("prepagent_sidebar_collapsed") === "true";
    setIsCollapsed(collapsed);
    
    // Dispatch initial layout state
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("sidebarCollapseChange", { detail: { collapsed } })
      );
    }, 100);

    setMounted(true);
  }, []);

  const cycleTheme = () => {
    const currentIndex = themes.findIndex((t) => t.value === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const newTheme = themes[nextIndex].value;
    updateSettings({ theme: newTheme });
  };

  const handleSelectTheme = (val: typeof theme) => {
    updateSettings({ theme: val });
  };

  const toggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    localStorage.setItem("prepagent_sidebar_collapsed", String(newCollapsed));
    
    // Broadcast custom event so page layouts can update margins dynamically
    window.dispatchEvent(
      new CustomEvent("sidebarCollapseChange", { detail: { collapsed: newCollapsed } })
    );
  };

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Study Library", href: "/library", icon: Database },
    { name: "Upload Materials", href: "/upload", icon: UploadCloud },
    { name: "Study Notes", href: "/notes", icon: BookOpen },
    { name: "Quiz Engine", href: "/quiz", icon: Award },
    { name: "Current Affairs", href: "/current-affairs", icon: Newspaper },
    { name: "Socratic Coach", href: "/socratic", icon: MessageSquare },
    { name: "PYQ Analysis", href: "/pyq", icon: BarChart2 },
    { name: "Wiki Explorer", href: "/wiki", icon: Network },
    { name: "Settings", href: "/settings", icon: SettingsIcon },
  ];

  if (!mounted) return null;

  return (
    <aside
      className={`border-r border-slate-200 bg-white py-6 flex flex-col justify-between dark:border-slate-800 dark:bg-[#0e1322] h-screen sticky top-0 transition-all duration-300 ease-in-out shrink-0 ${
        isCollapsed ? "w-20 px-2.5" : "w-64 px-4"
      }`}
    >
      <div>
        {/* Logo */}
        <div className={`flex items-center gap-3 px-3 mb-8 ${isCollapsed ? "justify-center" : ""}`}>
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 text-white shadow-md shadow-indigo-500/20 shrink-0">
            <GraduationCap className="h-6 w-6" />
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in">
              <h1 className="font-bold text-lg leading-tight bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent dark:from-indigo-400 dark:to-cyan-300">
                PrepAgent
              </h1>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                AI Study Suite
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center rounded-xl text-sm font-medium transition-all duration-150 relative group ${
                  isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
                } ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border-l-4 border-indigo-500"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/50 dark:hover:text-slate-200"
                }`}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    isActive ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
                  }`}
                />
                {!isCollapsed && <span className="animate-fade-in truncate">{item.name}</span>}

                {/* Collapsed Tooltip Overlay */}
                {isCollapsed && (
                  <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl backdrop-blur-md z-50 hidden group-hover:block select-none pointer-events-none whitespace-nowrap animate-fade-in border border-slate-800">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Collapse Trigger & Theme Toggle */}
      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        
        {/* Theme Picker Module */}
        {isCollapsed ? (
          <button
            onClick={cycleTheme}
            className="w-full flex items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition relative group shrink-0 cursor-pointer"
            title={`Active Theme: ${themes.find((t) => t.value === theme)?.label || "Obsidian"} (Click to Cycle)`}
          >
            <Palette className="h-5 w-5 text-indigo-500 shrink-0" />
            
            {/* Collapsed Tooltip Overlay */}
            <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl backdrop-blur-md z-50 hidden group-hover:block select-none pointer-events-none whitespace-nowrap animate-fade-in border border-slate-800">
              🎨 Theme: {themes.find((t) => t.value === theme)?.label || "Obsidian"}
            </span>
          </button>
        ) : (
          <div className="flex flex-col gap-1.5 px-1">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 select-none mb-0.5">
              <Palette className="h-3.5 w-3.5 text-indigo-500" /> Study Theme
            </label>
            <CustomDropdown
              options={themes}
              value={theme}
              onChange={handleSelectTheme as any}
            />
          </div>
        )}

        {/* Sidebar Collapse Toggle Trigger */}
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-400 hover:text-indigo-500 transition cursor-pointer"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-indigo-500 shrink-0 animate-fade-in" />
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold select-none text-slate-500 dark:text-slate-400">
              <ChevronLeft className="h-4 w-4 text-indigo-500 shrink-0" />
              <span>Collapse Menu</span>
            </div>
          )}
        </button>

      </div>
    </aside>
  );
}
