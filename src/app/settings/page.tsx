"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import {
  Settings as SettingsIcon,
  Shield,
  Server,
  CloudLightning,
  CheckCircle,
  XCircle,
  Loader2,
  Lock,
  Palette,
} from "lucide-react";
import { loadSettings, saveSettings, UserSettings, getAIHeaders } from "@/lib/settings";
import CustomDropdown from "@/components/CustomDropdown";

export default function Settings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const geminiModels = [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Standard - Default)", icon: "⚡" },
    { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash (Frontier Speed)", icon: "🚀" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Deep Complex Reasoning)", icon: "🧠" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite (Low Latency)", icon: "📉" },
  ];
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const handleChange = (key: keyof UserSettings, value: any) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleTestConnection = async () => {
    if (!settings) return;
    setTesting(true);
    setTestResult(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...getAIHeaders(),
      };

      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers,
      });


      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `Connected successfully! Provider replied: "${data.message}"`,
        });
      } else {
        setTestResult({
          success: false,
          error: data.error || "Connection refused. Please ensure your key is valid or your local server is running.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || "Network error. Failed to reach the local endpoint.",
      });
    } finally {
      setTesting(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#0b0f19]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0b0f19]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        
        <div className="flex-1 overflow-y-auto">
          <main className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              AI Configuration
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Configure your underlying LLM engines and credentials. All API keys remain strictly local to your browser.
            </p>
          </div>
        </div>

        <div className="space-y-6">

          {/* Study Themes Selection */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">PrepAgent Visual Styles</h2>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 -mt-2 leading-relaxed">
              Select a specialized study theme designed to improve reading comprehension, aid memory retention, and reduce eye fatigue during long sessions.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {([
                {
                  value: "theme-dark" as const,
                  name: "Obsidian Dark",
                  desc: "Midnight abyss with rich dark slate tones and vibrant indigo accents. The standard developer experience.",
                  colors: ["bg-[#0b0f19]", "bg-[#111726]", "bg-[#6366f1]"]
                },
                {
                  value: "theme-light" as const,
                  name: "Ivory Light",
                  desc: "Ultra-clean high-contrast theme featuring absolute paper-white cards and deep slate charcoal text.",
                  colors: ["bg-[#f8fafc]", "bg-[#ffffff]", "bg-[#4f46e5]"]
                },
                {
                  value: "theme-sepia" as const,
                  name: "Warm Sepia",
                  desc: "Smooth cream-antique paper background with soft charcoal brown text. Ideal for late-night reading sessions.",
                  colors: ["bg-[#fbf0d9]", "bg-[#f2e3c6]", "bg-[#b58900]"]
                },
                {
                  value: "theme-forest" as const,
                  name: "Pine Forest",
                  desc: "Soothing deep-green pine background with soft sage cards and fresh mint text. Extremely calming.",
                  colors: ["bg-[#0b1a11]", "bg-[#12281a]", "bg-[#10b981]"]
                },
                {
                  value: "theme-ocean" as const,
                  name: "Midnight Ocean",
                  desc: "Cold abyssal blue canvas combined with sharp sea-blue borders and vivid cyan highlights.",
                  colors: ["bg-[#030813]", "bg-[#081120]", "bg-[#06b6d4]"]
                }
              ]).map((t) => {
                const isActive = settings.theme === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => handleChange("theme", t.value)}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-48 transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/10 shadow-sm"
                        : "border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900/30"
                    }`}
                  >
                    <div>
                      {/* Theme Palettes preview circles */}
                      <div className="flex items-center gap-1.5 mb-3 select-none pointer-events-none">
                        {t.colors.map((c, i) => (
                          <span
                            key={i}
                            className={`h-4.5 w-4.5 rounded-full border border-slate-200/20 shadow-sm ${c}`}
                          />
                        ))}
                      </div>
                      
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {t.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
                        {t.desc}
                      </p>
                    </div>
                    
                    {isActive && (
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-500 dark:text-indigo-400 mt-2 select-none">
                        ✓ Active Layout Style
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Provider Selection Toggle */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Choose AI Mode</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Local Mode Option */}
              <button
                onClick={() => handleChange("provider", "local")}
                className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                  settings.provider === "local"
                    ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20"
                    : "border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/30"
                }`}
              >
                <div className={`p-2.5 rounded-xl ${settings.provider === "local" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Local AI (LM Studio)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Completely offline & free. Leverages models hosted locally on your device via LM Studio's standard server.
                  </p>
                  <span className="inline-block mt-3 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-500 uppercase">
                    Zero Cost
                  </span>
                </div>
              </button>

              {/* Cloud Mode Option */}
              <button
                onClick={() => handleChange("provider", "cloud")}
                className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                  settings.provider === "cloud"
                    ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20"
                    : "border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/30"
                }`}
              >
                <div className={`p-2.5 rounded-xl ${settings.provider === "cloud" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                  <CloudLightning className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Cloud AI (Google Gemini)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Powered by Google Gemini 1.5 Flash. Ideal for fast, highly accurate multimodal OCR, transcript scanning, and complex note-taking.
                  </p>
                  <span className="inline-block mt-3 text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-500 uppercase">
                    High Performance
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Form details based on provider */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {settings.provider === "local" ? "LM Studio Local Parameters" : "Google Cloud Credentials"}
            </h2>

            {settings.provider === "local" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    LM Studio Local Server Endpoint
                  </label>
                  <input
                    type="text"
                    value={settings.lmStudioEndpoint}
                    onChange={(e) => handleChange("lmStudioEndpoint", e.target.value)}
                    placeholder="http://localhost:1234/v1"
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Target Model Name
                  </label>
                  <input
                    type="text"
                    value={settings.lmStudioModel}
                    onChange={(e) => handleChange("lmStudioModel", e.target.value)}
                    placeholder="model-identifier"
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Google Gemini API Key
                    </label>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                      <Lock className="h-3 w-3" /> Securely Sandboxed
                    </span>
                  </div>
                  <input
                    type="password"
                    value={settings.geminiApiKey}
                    onChange={(e) => handleChange("geminiApiKey", e.target.value)}
                    placeholder="Enter AIzaSy..."
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition tracking-widest text-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                    Active Google Gemini Model
                  </label>
                  <CustomDropdown
                    options={geminiModels}
                    value={settings.geminiModel || "gemini-2.5-flash"}
                    onChange={(val) => handleChange("geminiModel", val)}
                  />
                </div>
              </div>
            )}

            {/* Test Connection Button */}
            <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 mt-6">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Shield className="h-4 w-4 text-emerald-500" />
                All processing executes in your own device context.
              </div>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 transition"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Test Connection"
                )}
              </button>
            </div>

            {/* Test Results Output */}
            {testResult && (
              <div
                className={`mt-4 p-4 rounded-xl border flex items-start gap-3 text-sm transition-all duration-200 ${
                  testResult.success
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-400"
                }`}
              >
                {testResult.success ? (
                  <>
                    <CheckCircle className="h-5 w-5 shrink-0" />
                    <div>
                      <h4 className="font-bold">Connection Stable</h4>
                      <p className="text-xs mt-0.5">{testResult.message}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 shrink-0" />
                    <div>
                      <h4 className="font-bold">Connection Failed</h4>
                      <p className="text-xs mt-0.5">{testResult.error}</p>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>

        </div>
      </main>
        </div>
      </div>
    </div>
  );
}
