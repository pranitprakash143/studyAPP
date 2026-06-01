"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import LoadingState from "@/components/LoadingState";
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
  Terminal,
} from "lucide-react";
import { UserSettings } from "@/lib/settings";
import { useAIConfig } from "@/contexts/AIConfigContext";
import CustomDropdown from "@/components/CustomDropdown";

export default function Settings() {
  const { settings, updateSettings, aiHeaders, isHydrated } = useAIConfig();

  const geminiModels = [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Fast & Free Tier - Default)", icon: "⚡" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (Cheapest)", icon: "✨" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Complex Reasoning - Paid)", icon: "🧠" },
  ];
  
  const openaiModels = [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Cheapest - Default)", icon: "⚡" },
    { value: "gpt-4o", label: "GPT-4o (Fast & Intelligent)", icon: "🚀" },
    { value: "gpt-5.4-nano", label: "GPT-5.4 Nano (Ultra Cheap, High Volume)", icon: "✨" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini (Best Value)", icon: "⚡" },
  ];

  const groqModels = [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Versatile - Default)", icon: "🧠" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Fastest)", icon: "⚡" },
    { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B (High Context)", icon: "🚀" },
    { value: "gemma2-9b-it", label: "Gemma 2 9B (Google Open)", icon: "🌟" },
    { value: "llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B (Latest)", icon: "🆕" },
    { value: "qwen-qwen3-32b", label: "Qwen3 32B (Strong Reasoning)", icon: "🧠" },
  ];

  const openrouterModels = [
    { value: "openrouter/free", label: "OpenRouter Free (Auto-Routes - Default)", icon: "🤖" },
    { value: "openai/gpt-oss-120b:free", label: "GPT-OSS 120B Free", icon: "🧠" },
    { value: "openai/gpt-oss-20b:free", label: "GPT-OSS 20B Free", icon: "⚡" },
    { value: "deepseek/deepseek-v4-flash:free", label: "DeepSeek V4 Flash Free", icon: "🚀" },
    { value: "google/gemma-4-31b-it:free", label: "Gemma 4 31B Free", icon: "🌟" },
    { value: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B Free", icon: "🧠" },
    { value: "qwen/qwen3-coder:free", label: "Qwen3 Coder Free", icon: "💻" },
    { value: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B Free", icon: "🆕" },
  ];

  const mistralModels = [
    { value: "mistral-small-latest", label: "Mistral Small (Fast - Default)", icon: "⚡" },
    { value: "mistral-large-latest", label: "Mistral Large (High Intelligence)", icon: "🧠" },
    { value: "codestral-latest", label: "Codestral (Coding Specialist)", icon: "💻" },
    { value: "ministral-3b-latest", label: "Ministral 3B (Ultra Lightweight)", icon: "✨" },
  ];

  const deepseekModels = [
    { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash (Flagship - Default)", icon: "⚡" },
    { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro (Flagship Reasoning)", icon: "🧠" },
    { value: "deepseek-chat", label: "DeepSeek V3 (Cheapest - Legacy)", icon: "✨" },
  ];

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  const handleChange = (key: keyof UserSettings, value: any) => {
    updateSettings({ [key]: value });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...aiHeaders,
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

  if (!isHydrated) {
    return <LoadingState message="Loading settings..." />;
  }

  return (
    <PageLayout maxWidth="4xl">
      <PageHeader
        icon={<SettingsIcon className="h-6 w-6" />}
        title="AI Configuration"
        description="Configure your underlying LLM engines and credentials. All API keys remain strictly local to your browser."
      />

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
            {[
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
            ].map((t) => {
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Local Mode Option */}
            <button
              onClick={() => handleChange("provider", "local")}
              className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                settings.provider === "local"
                  ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/30"
              }`}
            >
              <div className={`p-2.5 rounded-xl ${settings.provider === "local" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Local AI (LM Studio)</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Completely offline & free. Leverages models hosted locally on your device via LM Studio's standard server.
                </p>
                <span className="inline-block mt-3 text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-500 uppercase">
                  Zero Cost
                </span>
              </div>
            </button>

            {/* Cloud Mode Option */}
            <button
              onClick={() => handleChange("provider", "cloud")}
              className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                settings.provider === "cloud"
                  ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/30"
              }`}
            >
              <div className={`p-2.5 rounded-xl ${settings.provider === "cloud" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                <CloudLightning className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Google Gemini</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Powered by Google Gemini 2.0 Flash. Ideal for fast, highly accurate multimodal OCR, transcript scanning, and note taking.
                </p>
                <span className="inline-block mt-3 text-[9px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-500 uppercase">
                  High Performance
                </span>
              </div>
            </button>

            {/* OpenAI Mode Option */}
            <button
              onClick={() => handleChange("provider", "openai")}
              className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                settings.provider === "openai"
                  ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/30"
              }`}
            >
              <div className={`p-2.5 rounded-xl ${settings.provider === "openai" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                <CloudLightning className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">OpenAI (ChatGPT)</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Powered by OpenAI ChatGPT models. Offers industry-standard text generation and versatile contextual reasoning.
                </p>
                <span className="inline-block mt-3 text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-500 uppercase">
                  Industry Standard
                </span>
              </div>
            </button>

            {/* Groq LPU Option */}
            <button
              onClick={() => handleChange("provider", "groq")}
              className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                settings.provider === "groq"
                  ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/30"
              }`}
            >
              <div className={`p-2.5 rounded-xl ${settings.provider === "groq" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                <CloudLightning className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Groq LPU</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Powered by LPU hardware for ultra-low latency inference. Free developer tier with high speeds using Llama 3 models.
                </p>
                <span className="inline-block mt-3 text-[9px] px-2 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-500 uppercase">
                  Ultra Fast & Free
                </span>
              </div>
            </button>

            {/* OpenRouter Option */}
            <button
              onClick={() => handleChange("provider", "openrouter")}
              className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                settings.provider === "openrouter"
                  ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/30"
              }`}
            >
              <div className={`p-2.5 rounded-xl ${settings.provider === "openrouter" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                <CloudLightning className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">OpenRouter</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Unified endpoint routing to hundreds of open-source and commercial models, including a pool of completely free models.
                </p>
                <span className="inline-block mt-3 text-[9px] px-2 py-0.5 rounded-full font-bold bg-sky-500/10 text-sky-500 uppercase">
                  Free Catalog
                </span>
              </div>
            </button>

            {/* Mistral AI Option */}
            <button
              onClick={() => handleChange("provider", "mistral")}
              className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                settings.provider === "mistral"
                  ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/30"
              }`}
            >
              <div className={`p-2.5 rounded-xl ${settings.provider === "mistral" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                <CloudLightning className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Mistral AI</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Sleek European open-weights AI provider. Experiment plan provides free models like Mistral Small upon phone verification.
                </p>
                <span className="inline-block mt-3 text-[9px] px-2 py-0.5 rounded-full font-bold bg-orange-500/10 text-orange-500 uppercase">
                  Experiment Plan
                </span>
              </div>
            </button>

            {/* DeepSeek Option */}
            <button
              onClick={() => handleChange("provider", "deepseek")}
              className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                settings.provider === "deepseek"
                  ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/30"
              }`}
            >
              <div className={`p-2.5 rounded-xl ${settings.provider === "deepseek" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                <CloudLightning className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">DeepSeek</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Flagship performance at a tiny fraction of normal cost. V4 Flash/Pro models provide blazing speed and thinking paths.
                </p>
                <span className="inline-block mt-3 text-[9px] px-2 py-0.5 rounded-full font-bold bg-cyan-500/10 text-cyan-500 uppercase">
                  Pay-As-You-Go
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Form details based on provider */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {settings.provider === "local"
              ? "LM Studio Local Parameters"
              : settings.provider === "openai"
              ? "OpenAI API Credentials"
              : settings.provider === "cloud"
              ? "Google Cloud Credentials"
              : settings.provider === "groq"
              ? "Groq API Credentials"
              : settings.provider === "openrouter"
              ? "OpenRouter API Credentials"
              : settings.provider === "mistral"
              ? "Mistral AI Credentials"
              : "DeepSeek API Credentials"}
          </h2>

          {settings.provider === "local" && (
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
          )}

          {settings.provider === "openai" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    OpenAI API Key
                  </label>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                    <Lock className="h-3 w-3" /> Securely Sandboxed
                  </span>
                </div>
                <input
                  type="password"
                  value={settings.openaiApiKey || ""}
                  onChange={(e) => handleChange("openaiApiKey", e.target.value)}
                  placeholder="Enter sk-... (blank to fall back to env variable)"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition tracking-widest text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                  Active OpenAI Model
                </label>
                <CustomDropdown
                  options={openaiModels}
                  value={settings.openaiModel || "gpt-4o-mini"}
                  onChange={(val) => handleChange("openaiModel", val)}
                />
              </div>
            </div>
          )}

          {settings.provider === "cloud" && (
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
                  value={settings.geminiApiKey || ""}
                  onChange={(e) => handleChange("geminiApiKey", e.target.value)}
                  placeholder="Enter AIzaSy... (blank to fall back to env variable)"
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

          {settings.provider === "groq" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Groq API Key
                  </label>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                    <Lock className="h-3 w-3" /> Securely Sandboxed
                  </span>
                </div>
                <input
                  type="password"
                  value={settings.groqApiKey || ""}
                  onChange={(e) => handleChange("groqApiKey", e.target.value)}
                  placeholder="Enter gsk_... (blank to fall back to env variable)"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition tracking-widest text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                  Active Groq Model
                </label>
                <CustomDropdown
                  options={groqModels}
                  value={settings.groqModel || "llama-3.3-70b-versatile"}
                  onChange={(val) => handleChange("groqModel", val)}
                />
              </div>
            </div>
          )}

          {settings.provider === "openrouter" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    OpenRouter API Key
                  </label>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                    <Lock className="h-3 w-3" /> Securely Sandboxed
                  </span>
                </div>
                <input
                  type="password"
                  value={settings.openrouterApiKey || ""}
                  onChange={(e) => handleChange("openrouterApiKey", e.target.value)}
                  placeholder="Enter sk-or-... (blank to fall back to env variable)"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition tracking-widest text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                  Active OpenRouter Model
                </label>
                <CustomDropdown
                  options={openrouterModels}
                  value={settings.openrouterModel || "openrouter/free"}
                  onChange={(val) => handleChange("openrouterModel", val)}
                />
              </div>
            </div>
          )}

          {settings.provider === "mistral" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Mistral API Key
                  </label>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                    <Lock className="h-3 w-3" /> Securely Sandboxed
                  </span>
                </div>
                <input
                  type="password"
                  value={settings.mistralApiKey || ""}
                  onChange={(e) => handleChange("mistralApiKey", e.target.value)}
                  placeholder="Enter Mistral Key (blank to fall back to env variable)"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition tracking-widest text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                  Active Mistral Model
                </label>
                <CustomDropdown
                  options={mistralModels}
                  value={settings.mistralModel || "mistral-small-latest"}
                  onChange={(val) => handleChange("mistralModel", val)}
                />
              </div>
            </div>
          )}

          {settings.provider === "deepseek" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    DeepSeek API Key
                  </label>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                    <Lock className="h-3 w-3" /> Securely Sandboxed
                  </span>
                </div>
                <input
                  type="password"
                  value={settings.deepseekApiKey || ""}
                  onChange={(e) => handleChange("deepseekApiKey", e.target.value)}
                  placeholder="Enter sk-... (blank to fall back to env variable)"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition tracking-widest text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                  Active DeepSeek Model
                </label>
                <CustomDropdown
                  options={deepseekModels}
                  value={settings.deepseekModel || "deepseek-v4-flash"}
                  onChange={(val) => handleChange("deepseekModel", val)}
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

        {/* Diagnostics Portal Card */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 mt-1">
              <Terminal className="h-6 w-6 text-indigo-500 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Production Logs & diagnostics</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-xl">
                Having connection or ingestion issues? Access the real-time production server logs to immediately pinpoint and fix API credentials, networking blockages, or background graph execution errors.
              </p>
            </div>
          </div>
          
          <Link
            href="/settings/diagnostics"
            className="whitespace-nowrap px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm flex items-center justify-center gap-1.5 transition-all duration-200"
          >
            Open Diagnostics Portal →
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
