"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import ErrorAlert from "@/components/ErrorAlert";
import {
  Newspaper,
  Sparkles,
  Globe,
  MapPin,
  Loader2,
  RefreshCw,
  FileText,
  CheckCircle2,
  Library,
  Clock,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { useCurationFlow } from "./hooks/useCurationFlow";
import { SectionRenderer } from "./NewsCard";
import { parseMarkdownToDigest } from "./utils";
import type { NewsItem, NewsDigest } from "./utils";

export default function CurrentAffairsPage() {
  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");
  const { state, deploy, cancel: cancelCuration, saveItem, itemKey } = useCurationFlow();
  const {
    loading, error, progress, statusLabel, showLive, liveText,
    digest, allItems, savedItemIds, saveAllDone,
  } = state;

  // Speech synthesis
  const [speakingHeadline, setSpeakingHeadline] = useState<string | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // History tab
  const [historyTopics, setHistoryTopics] = useState<string[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topicContent, setTopicContent] = useState("");
  const [topicDigest, setTopicDigest] = useState<NewsDigest | null>(null);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/current-affairs/history");
      const data = await res.json() as { success?: boolean; topics?: string[] };
      if (data.success) setHistoryTopics(data.topics || []);
    } catch {
      console.error("Failed to fetch history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
  }, [activeTab, fetchHistory]);

  const handleViewTopic = async (topic: string) => {
    setSelectedTopic(topic);
    setTopicContent("");
    setTopicDigest(null);
    try {
      const res = await fetch("/api/current-affairs/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json() as { success?: boolean; content?: string };
      if (data.success) {
        setTopicContent(data.content || "");
        const parsed = parseMarkdownToDigest(data.content || "");

        const fetchImg = async (item: NewsItem): Promise<NewsItem> => {
          try {
            const query = encodeURIComponent(item.headline);
            const category = encodeURIComponent(item.category || "");
            const imgRes = await fetch(`/api/current-affairs/image?query=${query}&category=${category}`);
            const imgData = await imgRes.json() as { success?: boolean; imageUrl?: string };
            if (imgData.success && imgData.imageUrl) {
              return { ...item, imageUrl: imgData.imageUrl };
            }
          } catch {
            // keep item without image
          }
          return item;
        };

        const enriched = {
          india: await Promise.all(parsed.india.map(fetchImg)),
          assam: await Promise.all(parsed.assam.map(fetchImg)),
          world: await Promise.all(parsed.world.map(fetchImg)),
        };
        setTopicDigest(enriched);
      }
    } catch {
      console.error("Failed to load topic");
    }
  };

  const handleToggleSpeak = (item: NewsItem) => {
    if (!window.speechSynthesis) return;

    if (speakingHeadline === item.headline) {
      window.speechSynthesis.cancel();
      setSpeakingHeadline(null);
      return;
    }

    window.speechSynthesis.cancel();
    const textToSpeak = `${item.headline}. Curation details: ${item.summary}. Source: ${item.source}. Exam Relevance: ${item.examRelevance || "General relevance"}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingHeadline(null);
    utterance.onerror = () => setSpeakingHeadline(null);

    speechUtteranceRef.current = utterance;
    setSpeakingHeadline(item.headline);
    window.speechSynthesis.speak(utterance);
  };

  const handleSaveItem = async (item: NewsItem) => {
    await saveItem(item);
  };

  const renderSection = (title: string, icon: React.ReactNode, items: NewsItem[]) => {
    if (items.length === 0) return null;
    return (
      <SectionRenderer
        title={title}
        icon={icon}
        items={items}
        savedItemIds={savedItemIds}
        itemKeyFn={itemKey}
        speakingHeadline={speakingHeadline}
        onSave={handleSaveItem}
        onToggleSpeak={handleToggleSpeak}
      />
    );
  };

  const hasAnyItems = digest && (digest.india.length > 0 || digest.assam.length > 0 || digest.world.length > 0);

  return (
    <PageLayout maxWidth="7xl">
      <div className="relative mb-8">
        <PageHeader
          icon={<Newspaper className="h-6 w-6 text-indigo-500" />}
          title="Current Affairs Curation Hub"
          description="A beautiful, interactive visual dashboard curating competitive exam current affairs from top Indian, Assam, and global resources."
        />
        <div className="absolute -top-10 right-0 w-80 h-80 bg-indigo-500/5 dark:bg-indigo-500/3 blur-3xl rounded-full pointer-events-none -z-10" />
      </div>

      <div className="flex items-center gap-1.5 mb-8 p-1.5 w-fit rounded-xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/50">
        <button
          onClick={() => setActiveTab("generate")}
          className={`px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "generate"
              ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50"
              : "text-slate-555 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Deploy Curation Node
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "history"
              ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50"
              : "text-slate-555 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Clock className="h-3.5 w-3.5" /> Historical Timeline
        </button>
      </div>

      {activeTab === "generate" && (
        <>
          <div className="flex flex-col items-center justify-center mb-10">
            <button
              onClick={loading ? cancelCuration : deploy}
              className={`group px-8 py-4.5 rounded-2xl text-white font-extrabold text-sm shadow-xl transition-all duration-300 flex items-center gap-3 cursor-pointer ${
                loading
                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/10"
                  : "bg-gradient-to-r from-indigo-650 to-cyan-500 hover:from-indigo-600 hover:to-cyan-450 shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-95"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Cancel Curation
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 group-hover:animate-pulse" /> Deploy AI Agent
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mb-8 max-w-2xl mx-auto">
              <ErrorAlert message={error} />
            </div>
          )}

          {loading && (
            <div className="mb-10 max-w-2xl mx-auto p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c101d]/60 backdrop-blur-md shadow-xl animate-pulse">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-555 dark:text-slate-400 flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                    {statusLabel}
                  </span>
                  <span className="font-mono font-bold text-indigo-550">{progress}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500">
                  <span>STAGE: Curation Dailies</span>
                  <span>NODE ACTIVE: true</span>
                </div>
              </div>
            </div>
          )}

          {showLive && liveText && (
            <div className="mb-10 animate-fade-in max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[10px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest">
                    LIVE CURATION LOG STREAM
                  </span>
                </div>
                <span className="text-[9px] font-mono text-slate-400">BYTES: {liveText.length}</span>
              </div>
              <div className="max-h-64 overflow-y-auto p-5 rounded-2xl border border-slate-250 dark:border-slate-800 bg-[#070b13] font-mono text-[11px] leading-relaxed text-indigo-250 dark:text-cyan-400/90 whitespace-pre-wrap custom-scrollbar shadow-inner">
                {liveText}
                {loading && <span className="inline-block w-2.5 h-4 ml-0.5 bg-cyan-400 animate-pulse" />}
              </div>
            </div>
          )}

          {saveAllDone && !loading && !showLive && (
            <div className="mb-8 max-w-xl mx-auto">
              <div className="flex items-center gap-4.5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800 text-sm shadow-md shadow-emerald-500/5">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                <div>
                  <span className="font-extrabold text-emerald-800 dark:text-emerald-350 text-xs">
                    Curated Digest Auto-Saved
                  </span>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400/80 mt-0.5">
                    {allItems.length} news cards with dynamic imagery synced successfully.
                  </p>
                </div>
                <a
                  href="/subject?subject=Current%20Affairs"
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition shadow-sm shrink-0"
                >
                  <Library className="h-3.5 w-3.5" /> View Binder
                </a>
              </div>
            </div>
          )}

          {digest && !loading && (
            <div className="space-y-16 animate-fade-in">
              {hasAnyItems ? (
                <>
                  {renderSection("🇮🇳 National Curation", <Globe className="h-4.5 w-4.5 text-indigo-500" />, digest.india)}
                  {renderSection("🌾 Assam Region Curation", <MapPin className="h-4.5 w-4.5 text-amber-500" />, digest.assam)}
                  {renderSection("🌍 Global Curation", <Globe className="h-4.5 w-4.5 text-cyan-500" />, digest.world)}
                </>
              ) : (
                <div className="mb-8 p-6 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        Could not extract structured cards. Showing raw feed instead.
                      </span>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-xs font-mono leading-relaxed whitespace-pre-wrap custom-scrollbar">
                    {liveText || "No output received from AI."}
                  </div>
                </div>
              )}

              <div className="text-center pt-8 pb-10 border-t border-slate-100 dark:border-slate-900">
                <div className="flex items-center justify-center gap-2 mb-5 text-[10px] text-emerald-500 font-extrabold uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {allItems.length} stories curated &bull; {savedItemIds.size} saved
                </div>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={deploy}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Curate Fresh Feed
                  </button>
                  <a
                    href="/subject?subject=Current%20Affairs"
                    className="px-5 py-2.5 rounded-xl bg-indigo-550/10 text-indigo-650 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-550/20 transition flex items-center gap-2"
                  >
                    <Library className="h-3.5 w-3.5" /> Open Binder
                  </a>
                </div>
              </div>
            </div>
          )}

          {!digest && !loading && !error && !showLive && (
            <div className="flex flex-col items-center justify-center py-28 text-center max-w-lg mx-auto">
              <div className="w-20 h-20 mb-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 flex items-center justify-center border border-indigo-500/20 shadow-md">
                <Newspaper className="h-9 w-9 text-indigo-550" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200 mb-2">
                Deploy Curation Node
              </h3>
              <p className="text-xs text-slate-450 leading-relaxed max-w-sm">
                Deploy the PrepAgent curation node to scan, extract, and synthesize the daily newspaper feeds into exam-relevant visual dossiers.
              </p>
            </div>
          )}
        </>
      )}

      {activeTab === "history" && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 pb-3 mb-6 border-b border-slate-200 dark:border-slate-800">
            <Clock className="h-4.5 w-4.5 text-indigo-500" />
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Historical Timelines</h2>
            <span className="text-xs font-mono font-bold text-slate-400 ml-auto">
              {historyTopics.length} Digests Saved
            </span>
          </div>

          {historyLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <p className="mt-3.5 text-xs text-slate-400">Loading timelines...</p>
            </div>
          ) : historyTopics.length === 0 ? (
            <div className="py-20 text-center max-w-sm mx-auto">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-slate-105 dark:bg-slate-800/80 flex items-center justify-center border border-slate-200/10">
                <Clock className="h-6 w-6 text-slate-405" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-350 mb-1.5">Timeline is empty</h3>
              <p className="text-xs text-slate-405 leading-relaxed">
                Daily digests will automatically populate here as history once curated.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...historyTopics].reverse().map((topic) => (
                <div
                  key={topic}
                  onClick={() => handleViewTopic(topic)}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c101d] hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700/80 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-indigo-550" />
                    </div>
                    <div>
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">{topic}</span>
                      <p className="text-[10px] text-slate-450 mt-0.5">Explore curated news cards</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4.5 w-4.5 text-slate-300 group-hover:text-indigo-500 transition-transform group-hover:translate-x-0.5" />
                </div>
              ))}
            </div>
          )}

          {selectedTopic && (
            <div className="mt-12 animate-fade-in border-t border-slate-150 dark:border-slate-850 pt-10">
              <div className="flex items-center gap-3 pb-3 mb-8 border-b border-slate-205 dark:border-slate-800">
                <button
                  onClick={() => {
                    setSelectedTopic(null);
                    setTopicDigest(null);
                    setTopicContent("");
                  }}
                  className="text-xs font-bold text-indigo-500 hover:underline cursor-pointer"
                >
                  &larr; Back to Timelines
                </button>
                <span className="text-xs text-slate-300 mx-1">|</span>
                <Calendar className="h-4 w-4 text-indigo-555" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{selectedTopic}</h3>
              </div>

              {topicDigest && (topicDigest.india.length > 0 || topicDigest.assam.length > 0 || topicDigest.world.length > 0) ? (
                <div className="space-y-12">
                  <SectionRenderer
                    title="🇮🇳 National Curation"
                    icon={<Globe className="h-4.5 w-4.5 text-indigo-500" />}
                    items={topicDigest.india}
                    savedItemIds={savedItemIds}
                    itemKeyFn={itemKey}
                    speakingHeadline={speakingHeadline}
                    onSave={handleSaveItem}
                    onToggleSpeak={handleToggleSpeak}
                  />
                  <SectionRenderer
                    title="🌾 Assam Region Curation"
                    icon={<MapPin className="h-4.5 w-4.5 text-amber-500" />}
                    items={topicDigest.assam}
                    savedItemIds={savedItemIds}
                    itemKeyFn={itemKey}
                    speakingHeadline={speakingHeadline}
                    onSave={handleSaveItem}
                    onToggleSpeak={handleToggleSpeak}
                  />
                  <SectionRenderer
                    title="🌍 Global Curation"
                    icon={<Globe className="h-4.5 w-4.5 text-cyan-500" />}
                    items={topicDigest.world}
                    savedItemIds={savedItemIds}
                    itemKeyFn={itemKey}
                    speakingHeadline={speakingHeadline}
                    onSave={handleSaveItem}
                    onToggleSpeak={handleToggleSpeak}
                  />
                </div>
              ) : topicContent ? (
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c101d]">
                  <div className="max-h-[600px] overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap font-mono custom-scrollbar">
                    {topicContent}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
