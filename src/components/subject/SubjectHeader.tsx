"use client";

import { ArrowLeft, Eye, Columns, Sparkles, Network, Sliders, Maximize, Volume2, Download, Save, Loader2 } from "lucide-react";
import { formatDisplayName } from "@/lib/utils";
import CustomDropdown from "@/components/CustomDropdown";

type ViewTab = "preview" | "split" | "visual" | "mindmap";

interface SubjectHeaderProps {
  subject: string;
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  showReaderPrefs: boolean;
  onToggleReaderPrefs: () => void;
  onCloseReaderPrefs: () => void;
  activeFont: string;
  onFontChange: (font: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  pageWidth: number;
  onPageWidthChange: (width: number) => void;
  lineHeight: number;
  onLineHeightChange: (height: number) => void;
  letterSpacing: number;
  onLetterSpacingChange: (spacing: number) => void;
  wordSpacing: number;
  onWordSpacingChange: (spacing: number) => void;
  focusMode: boolean;
  onFocusModeChange: (focused: boolean) => void;
  aiPanelCollapsed: boolean;
  onAiPanelToggle: () => void;
  saving: boolean;
  onSave: () => void;
  onExportOpen: () => void;
  voices: SpeechSynthesisVoice[];
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  speechRate: number;
  onRateChange: (rate: number) => void;
}

export default function SubjectHeader({
  subject,
  activeTab,
  onTabChange,
  showReaderPrefs,
  onToggleReaderPrefs,
  onCloseReaderPrefs,
  activeFont,
  onFontChange,
  fontSize,
  onFontSizeChange,
  pageWidth,
  onPageWidthChange,
  lineHeight,
  onLineHeightChange,
  letterSpacing,
  onLetterSpacingChange,
  wordSpacing,
  onWordSpacingChange,
  focusMode,
  onFocusModeChange,
  aiPanelCollapsed,
  onAiPanelToggle,
  saving,
  onSave,
  onExportOpen,
  voices,
  selectedVoice,
  onVoiceChange,
  speechRate,
  onRateChange,
}: SubjectHeaderProps) {
  const tabs: { key: ViewTab; icon: React.ComponentType<any>; label: string }[] = [
    { key: "preview", icon: Eye, label: "Preview" },
    { key: "split", icon: Columns, label: "Split" },
    { key: "visual", icon: Sparkles, label: "Visual Editor" },
    { key: "mindmap", icon: Network, label: "Mindmap" },
  ];

  return (
    <header className="px-5 py-3 bg-white dark:bg-[#111726] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 z-10">
      <div className="flex items-center gap-3">
        <a
          href="/library"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{formatDisplayName(subject)}</h1>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Study notes &amp; chapters</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center gap-0.5 mr-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.key
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {(activeTab === "preview" || activeTab === "split" || activeTab === "visual" || activeTab === "mindmap") && (
          <div className="relative">
            <button 
              onClick={onToggleReaderPrefs}
              className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                showReaderPrefs
                  ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                  : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
              title="Reader Preferences"
            >
              <Sliders className="h-4 w-4" />
              <span>Reader Prefs</span>
            </button>

            {showReaderPrefs && (
              <>
                <div className="fixed inset-0 z-40" onClick={onCloseReaderPrefs} />
                
                <div className="absolute right-0 top-full mt-2 w-80 p-4 bg-white/95 dark:bg-[#111726]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 animate-fade-in space-y-4 text-slate-800 dark:text-slate-200">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-indigo-500" /> Typography Settings
                    </h4>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 block">Font Family</label>
                      <CustomDropdown
                        options={[
                          { value: "garamond", label: "EB Garamond", icon: "📜", description: "Warm book serif" },
                          { value: "caveat", label: "Cozy Cursive", icon: "✍️", description: "Soft journal script" },
                          { value: "architect", label: "Architect Hand", icon: "📐", description: "Technical hand-lettering" },
                          { value: "cinzel", label: "Classical Roman", icon: "🏛️", description: "Roman display serif" },
                          { value: "georgia", label: "Georgia Book", icon: "📚", description: "Standard book serif" },
                          { value: "sans", label: "Modern Sans", icon: "🌐", description: "High legibility screen" },
                        ]}
                        value={activeFont}
                        onChange={onFontChange}
                        placeholder="Select Font"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 block">Font Size</label>
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/60 justify-between">
                          <button onClick={() => onFontSizeChange(Math.max(12, fontSize - 2))}
                            className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition font-bold">A-</button>
                          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{fontSize}px</span>
                          <button onClick={() => onFontSizeChange(Math.min(32, fontSize + 2))}
                            className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition font-bold">A+</button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 block">Focus View</label>
                        <button onClick={() => { onFocusModeChange(true); onCloseReaderPrefs(); }}
                          className="w-full py-1.5 px-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition flex items-center justify-center gap-1 cursor-pointer">
                          <Maximize className="h-3.5 w-3.5" /> Fullscreen
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-bold text-slate-500 block">Column Width</label>
                      <div className="grid grid-cols-3 gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/60">
                        {([
                          { value: 720, label: "Compact" },
                          { value: 860, label: "Normal" },
                          { value: 1080, label: "Wide" }
                        ]).map((opt) => (
                          <button key={opt.value} onClick={() => onPageWidthChange(opt.value)}
                            className={`py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                              pageWidth === opt.value
                                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700"
                                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-900"
                            }`}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-indigo-500" /> Spacing
                    </h4>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 block">Line Height</label>
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/60 justify-between">
                        <button onClick={() => onLineHeightChange(Math.max(1.2, +(lineHeight - 0.1).toFixed(1)))}
                          className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition font-bold text-xs">A-</button>
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{lineHeight}</span>
                        <button onClick={() => onLineHeightChange(Math.min(3.0, +(lineHeight + 0.1).toFixed(1)))}
                          className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition font-bold text-xs">A+</button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 block">Letter Spacing</label>
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/60 justify-between">
                        <button onClick={() => onLetterSpacingChange(Math.max(0, +(letterSpacing - 0.004).toFixed(3)))}
                          className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition font-bold text-xs">A-</button>
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{letterSpacing}em</span>
                        <button onClick={() => onLetterSpacingChange(Math.min(0.1, +(letterSpacing + 0.004).toFixed(3)))}
                          className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition font-bold text-xs">A+</button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 block">Word Spacing</label>
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/60 justify-between">
                        <button onClick={() => onWordSpacingChange(Math.max(0, +(wordSpacing - 0.01).toFixed(2)))}
                          className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition font-bold text-xs">A-</button>
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{wordSpacing}em</span>
                        <button onClick={() => onWordSpacingChange(Math.min(0.3, +(wordSpacing + 0.01).toFixed(2)))}
                          className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition font-bold text-xs">A+</button>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-200 dark:border-slate-850" />

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Volume2 className="h-3.5 w-3.5 text-indigo-500" /> Speech &amp; TTS Settings
                    </h4>

                    {voices.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 block">TTS Voice</label>
                        <CustomDropdown
                          options={voices.map(v => ({
                            value: v.voiceURI,
                            label: v.name.replace(/Microsoft|Google|Apple/g, "").trim(),
                            icon: "🗣️",
                            description: v.lang
                          }))}
                          value={selectedVoice}
                          onChange={onVoiceChange}
                          placeholder="Select Speech Voice"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                        <span>Reading Speed</span>
                        <span className="font-mono text-indigo-500">{speechRate}x</span>
                      </div>
                      <input type="range" min="0.5" max="2.0" step="0.1" value={speechRate}
                        onChange={(e) => onRateChange(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <button onClick={onAiPanelToggle}
          className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
            !aiPanelCollapsed
              ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
              : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-900"
          }`}
          title="AI Assistant Panel"
        >
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <span>AI Assistant</span>
        </button>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        <button onClick={onExportOpen}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 text-xs font-medium"
        >
          <Download className="h-3.5 w-3.5 text-indigo-500" /> Export
        </button>

        <button onClick={onSave} disabled={saving}
          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-xs shrink-0 transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : <><Save className="h-3.5 w-3.5" /> Save</>}
        </button>
      </div>
    </header>
  );
}
