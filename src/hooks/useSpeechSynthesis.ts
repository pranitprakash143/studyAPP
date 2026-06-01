"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface SpeechSynthesisHookOptions {
  onBlockChange?: (index: number) => void;
  onEnd?: () => void;
}

export function useSpeechSynthesis(text: string, options?: SpeechSynthesisHookOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentBlockIndex, setCurrentBlockIndex] = useState<number | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechPitch, setSpeechPitch] = useState(1.0);

  const isPlayingRef = useRef(false);
  const currentBlockIndexRef = useRef<number | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const selectedVoiceRef = useRef("");
  const speechRateRef = useRef(1.0);
  const speechPitchRef = useRef(1.0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs to avoid stale closures in callbacks
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentBlockIndexRef.current = currentBlockIndex; }, [currentBlockIndex]);
  useEffect(() => { voicesRef.current = voices; }, [voices]);
  useEffect(() => { selectedVoiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { speechRateRef.current = speechRate; }, [speechRate]);
  useEffect(() => { speechPitchRef.current = speechPitch; }, [speechPitch]);

  const cancelCurrentUtterance = useCallback(() => {
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
  }, []);

  // Load voices on mount
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (!list || list.length === 0) return;
      
      // Filter English and Hindi first
      const primaryVoices = list.filter(v => v.lang.startsWith("en") || v.lang.startsWith("hi"));
      const otherVoices = list.filter(v => !v.lang.startsWith("en") && !v.lang.startsWith("hi"));
      
      const isPremiumVoice = (v: SpeechSynthesisVoice) => {
        const name = v.name.toLowerCase();
        return name.includes("enhanced") || 
               name.includes("google") || 
               name.includes("siri") || 
               name.includes("premium") || 
               name.includes("natural") || 
               name.includes("samantha") || 
               name.includes("daniel");
      };

      const sortedPrimary = [...primaryVoices].sort((a, b) => {
        const aPrem = isPremiumVoice(a);
        const bPrem = isPremiumVoice(b);
        if (aPrem && !bPrem) return -1;
        if (!aPrem && bPrem) return 1;
        return 0;
      });

      const sorted = [...sortedPrimary, ...otherVoices];

      const uniqueVoices: SpeechSynthesisVoice[] = [];
      const seenURIs = new Set<string>();
      for (const v of sorted) {
        if (!seenURIs.has(v.voiceURI)) {
          seenURIs.add(v.voiceURI);
          uniqueVoices.push(v);
        }
      }

      setVoices(uniqueVoices);

      if (uniqueVoices.length > 0) {
        const preferred = sortedPrimary.find(v =>
          v.name.includes("Google US English") ||
          v.name.includes("Samantha") ||
          v.name.includes("Siri") ||
          v.name.includes("Daniel")
        ) || sortedPrimary.find(isPremiumVoice) || sortedPrimary[0];
        
        setSelectedVoice(preferred ? preferred.voiceURI : uniqueVoices[0].voiceURI);
      }
    };

    loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Explicit, fail-safe cleanup to prevent browser audio system locks
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.onvoiceschanged = null;
      }
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
      }
      cancelCurrentUtterance();
    };
  }, [cancelCurrentUtterance]);

  const cleanMarkdownForSpeech = (rawText: string): string => {
    return rawText
      .replace(/#+ Subject:/gi, "")
      .replace(/#+/g, "")
      .replace(/\*\*|__/g, "")
      .replace(/\*|_/g, "")
      .replace(/[-*•]\s+/g, "")
      .replace(/\|\s*[-:]+\s*\|/g, "")
      .replace(/\|/g, " ")
      .replace(/>\s?/g, "")
      .replace(/---\n/g, "")
      .trim();
  };

  const getBlocks = useCallback(() => {
    if (!text) return [];
    return text.replace(/\n\s*---\s*\n/g, "\n---\n").split("\n\n");
  }, [text]);

  const speakBlock = useCallback((index: number) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const blocks = getBlocks();

    if (index >= blocks.length || index < 0) {
      cancelCurrentUtterance();
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentBlockIndex(null);
      options?.onEnd?.();
      return;
    }

    const rawBlockText = blocks[index].trim();
    const speakableText = cleanMarkdownForSpeech(rawBlockText);

    if (!speakableText.trim()) {
      // Skip empty block
      speakBlock(index + 1);
      return;
    }

    setCurrentBlockIndex(index);
    options?.onBlockChange?.(index);
    setIsPlaying(true);
    setIsPaused(false);

    cancelCurrentUtterance();
    window.speechSynthesis.cancel();

    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
    }

    speakTimeoutRef.current = setTimeout(() => {
      if (!isPlayingRef.current) return;

      const utterance = new SpeechSynthesisUtterance(speakableText);
      const activeVoice = voicesRef.current.find(v => v.voiceURI === selectedVoiceRef.current);
      if (activeVoice) {
        utterance.voice = activeVoice;
      }

      utterance.rate = speechRateRef.current;
      utterance.pitch = speechPitchRef.current;

      utterance.onend = () => {
        cancelCurrentUtterance();
        if (isPlayingRef.current && !window.speechSynthesis.paused) {
          speakBlock(index + 1);
        }
      };

      utterance.onerror = (e) => {
        cancelCurrentUtterance();
        console.warn("SpeechSynthesis utterance error:", e);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }, 50);
  }, [getBlocks, options, cancelCurrentUtterance]);

  const play = useCallback((startIndex?: number | unknown) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    const startIdx = typeof startIndex === "number" 
      ? startIndex 
      : (currentBlockIndex !== null ? currentBlockIndex : 0);
    isPlayingRef.current = true;
    speakBlock(startIdx);
  }, [isPaused, currentBlockIndex, speakBlock]);

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    isPlayingRef.current = false;
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
    }
    cancelCurrentUtterance();
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentBlockIndex(null);
  }, [cancelCurrentUtterance]);

  const setVoice = useCallback((voiceURI: string) => {
    setSelectedVoice(voiceURI);
    if (isPlayingRef.current && currentBlockIndexRef.current !== null) {
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = setTimeout(() => {
        speakBlock(currentBlockIndexRef.current || 0);
      }, 100);
    }
  }, [speakBlock]);

  const setRate = useCallback((newRate: number) => {
    setSpeechRate(newRate);
    if (isPlayingRef.current && currentBlockIndexRef.current !== null) {
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = setTimeout(() => {
        speakBlock(currentBlockIndexRef.current || 0);
      }, 100);
    }
  }, [speakBlock]);

  const setPitch = useCallback((newPitch: number) => {
    setSpeechPitch(newPitch);
    if (isPlayingRef.current && currentBlockIndexRef.current !== null) {
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = setTimeout(() => {
        speakBlock(currentBlockIndexRef.current || 0);
      }, 100);
    }
  }, [speakBlock]);

  // Handle cleanup when hook text changes or component unmounts to prevent audio system locks
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        if (speakTimeoutRef.current) {
          clearTimeout(speakTimeoutRef.current);
        }
        cancelCurrentUtterance();
        window.speechSynthesis.cancel();
      }
    };
  }, [text, cancelCurrentUtterance]);

  return {
    isPlaying,
    isPaused,
    currentBlockIndex,
    voices,
    selectedVoice,
    speechRate,
    speechPitch,
    play,
    pause,
    stop,
    setVoice,
    setRate,
    setPitch,
    speakBlock,
  };
}
