"use client";

import { useState, useRef, useCallback } from "react";
import type { NewsItem, NewsDigest } from "../utils";
import { parseMarkdownToDigest } from "../utils";
import { getAIHeaders } from "@/lib/settings";

async function fetchImageForItem(item: NewsItem, signal?: AbortSignal): Promise<NewsItem> {
  try {
    const query = encodeURIComponent(item.headline);
    const category = encodeURIComponent(item.category || "");
    const res = await fetch(`/api/current-affairs/image?query=${query}&category=${category}`, { signal });
    const data = await res.json();
    if (data.success && data.imageUrl) {
      return { ...item, imageUrl: data.imageUrl };
    }
  } catch {
    // Network or abort errors are expected; keep item without image
  }
  return item;
}

async function batchFetchImages(items: NewsItem[], batchSize = 6, signal?: AbortSignal): Promise<NewsItem[]> {
  const results: NewsItem[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    if (signal?.aborted) return results.concat(items.slice(i));
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((item) => fetchImageForItem(item, signal)));
    results.push(...batchResults);
  }
  return results;
}

export interface CurationState {
  loading: boolean;
  error: string;
  progress: number;
  statusLabel: string;
  showLive: boolean;
  liveText: string;
  digest: NewsDigest | null;
  allItems: NewsItem[];
  savedItemIds: Set<string>;
  saveAllDone: boolean;
  showRaw: boolean;
}

const INITIAL_STATE: CurationState = {
  loading: false,
  error: "",
  progress: 0,
  statusLabel: "",
  showLive: false,
  liveText: "",
  digest: null,
  allItems: [],
  savedItemIds: new Set(),
  saveAllDone: false,
  showRaw: false,
};

export function useCurationFlow() {
  const [state, setState] = useState<CurationState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const itemKey = useCallback((item: NewsItem) => `${item.category}|${item.headline}`, []);

  const deploy = useCallback(async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setState((s) => ({
      ...s,
      loading: true,
      error: "",
      digest: null,
      allItems: [],
      progress: 0,
      liveText: "",
      statusLabel: "Initializing PrepAgent Curation Node...",
      showLive: true,
      savedItemIds: new Set(),
      saveAllDone: false,
      showRaw: false,
    }));

    try {
      const res = await fetch("/api/current-affairs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAIHeaders() },
        signal: abort.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || `Curation node failed: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Curation node output unreadable.");

      let accumulated = "";
      let hasIndia = false, hasAssam = false, hasWorld = false;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      const setProgress = (p: number) => {
        setState((s) => (s.progress !== p ? { ...s, progress: p } : s));
      };
      const setStatusLabel = (l: string) => {
        setState((s) => ({ ...s, statusLabel: l }));
      };

      setStatusLabel("Scanning Indian national newspapers...");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          setState((s) => ({ ...s, liveText: accumulated }));
        }, 200);

        if (!hasIndia && /##.+India/i.test(accumulated)) {
          hasIndia = true;
          setProgress(30);
          setStatusLabel("Indian newspapers curated. Scanning Assam local dailies...");
        }
        if (!hasAssam && /##.+Assam/i.test(accumulated)) {
          hasAssam = true;
          setProgress(60);
          setStatusLabel("Assam Tribune analyzed. Querying global world outlets...");
        }
        if (!hasWorld && /##.+World/i.test(accumulated)) {
          hasWorld = true;
          setProgress(85);
          setStatusLabel("Parsing global affairs and structuring items...");
        }

        const byteProgress = Math.min((accumulated.length / 8000) * 85, 84);
        if (!hasIndia || !hasAssam || !hasWorld) setProgress(Math.max(Math.floor(byteProgress), state.progress));
      }

      debounceTimer && clearTimeout(debounceTimer);
      setState((s) => ({ ...s, liveText: accumulated }));

      setProgress(90);
      setStatusLabel("Compiling visual news cards...");

      const parsed = parseMarkdownToDigest(accumulated);
      const enriched = await enrichWithImages(parsed, abort.signal);

      const flat = [...enriched.india, ...enriched.assam, ...enriched.world];

      if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");
      setState((s) => ({
        ...s,
        digest: enriched,
        allItems: flat,
        progress: 95,
        statusLabel: flat.length > 0 ? "Synchronizing saved binder..." : "Parse complete — no structured items found",
      }));

      if (flat.length > 0) {
        try {
          const saveRes = await fetch("/api/current-affairs/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: flat }),
          });
          const saveData = await saveRes.json();
          if ((saveData as { success?: boolean }).success) {
            setState((s) => ({
              ...s,
              saveAllDone: true,
              savedItemIds: new Set(flat.map(itemKey)),
              statusLabel: "Saved successfully!",
            }));
          }
        } catch {
          setState((s) => ({ ...s, statusLabel: "Complete (auto-save skipped)" }));
        }
      }

      setProgress(100);
      setTimeout(() => {
        setState((s) => ({ ...s, showLive: false }));
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setState((s) => ({
          ...INITIAL_STATE,
          savedItemIds: s.savedItemIds,
          saveAllDone: s.saveAllDone,
        }));
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to curate current affairs.";
      setState((s) => ({
        ...INITIAL_STATE,
        error: message,
        savedItemIds: s.savedItemIds,
        saveAllDone: s.saveAllDone,
      }));
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
      setState((s) => ({ ...s, loading: false }));
    }
  }, [itemKey]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const saveItem = useCallback(async (item: NewsItem) => {
    const key = itemKey(item);
    setState((s) => {
      if (s.savedItemIds.has(key)) return s;
      return s;
    });
    try {
      const res = await fetch("/api/current-affairs/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [item], topic: "Bookmarked" }),
      });
      const data = await res.json();
      if ((data as { success?: boolean }).success) {
        setState((s) => {
          const n = new Set(s.savedItemIds);
          n.add(key);
          return { ...s, savedItemIds: n };
        });
      }
    } catch {
      // Silently fail for bookmark saves
    }
  }, [itemKey]);

  return { state, deploy, cancel, saveItem, itemKey };
}

async function enrichWithImages(digestObj: NewsDigest, signal?: AbortSignal): Promise<NewsDigest> {
  const [india, assam, world] = await Promise.all([
    batchFetchImages(digestObj.india, 6, signal),
    batchFetchImages(digestObj.assam, 6, signal),
    batchFetchImages(digestObj.world, 6, signal),
  ]);
  return { india, assam, world };
}
