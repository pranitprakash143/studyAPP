"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { UserSettings, DEFAULT_SETTINGS, loadSettings, saveSettings, getAIHeaders } from "@/lib/settings";

interface AIConfigContextType {
  settings: UserSettings;
  aiHeaders: Record<string, string>;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  isHydrated: boolean;
}

const AIConfigContext = createContext<AIConfigContextType | undefined>(undefined);

export function AIConfigProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load settings on mount to avoid hydration mismatch
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setIsHydrated(true);
  }, []);

  // Provide a centralized method to update settings and propagate theme/localStorage changes
  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  };

  // Compute AI headers reactively from our settings state, avoiding localStorage reads
  const aiHeaders = useMemo(() => {
    return getAIHeaders(settings);
  }, [settings]);

  const value = useMemo(
    () => ({
      settings,
      aiHeaders,
      updateSettings,
      isHydrated,
    }),
    [settings, aiHeaders, isHydrated]
  );

  return (
    <AIConfigContext.Provider value={value}>
      {children}
    </AIConfigContext.Provider>
  );
}

export function useAIConfig() {
  const context = useContext(AIConfigContext);
  if (context === undefined) {
    throw new Error("useAIConfig must be used within an AIConfigProvider");
  }
  return context;
}
