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
    const headers: Record<string, string> = {};

    const cleanHeaderValue = (val: string | undefined | null): string => {
      if (!val) return "";
      return val
        .trim()
        .replace(/[\r\n]/g, "")
        .replace(/[^\x20-\x7E]/g, ""); // Allow only printable ASCII characters
    };

    const provider = cleanHeaderValue(settings.provider);
    if (provider) headers["x-ai-provider"] = provider;

    const geminiKey = cleanHeaderValue(settings.geminiApiKey);
    if (geminiKey) headers["x-gemini-api-key"] = geminiKey;

    const geminiModel = cleanHeaderValue(settings.geminiModel || "gemini-2.0-flash");
    if (geminiModel) headers["x-gemini-model"] = geminiModel;

    const openaiKey = cleanHeaderValue(settings.openaiApiKey);
    if (openaiKey) headers["x-openai-api-key"] = openaiKey;

    const openaiModel = cleanHeaderValue(settings.openaiModel || "gpt-4o-mini");
    if (openaiModel) headers["x-openai-model"] = openaiModel;

    const groqKey = cleanHeaderValue(settings.groqApiKey);
    if (groqKey) headers["x-groq-api-key"] = groqKey;

    const groqModel = cleanHeaderValue(settings.groqModel || "llama-3.3-70b-versatile");
    if (groqModel) headers["x-groq-model"] = groqModel;

    const openrouterKey = cleanHeaderValue(settings.openrouterApiKey);
    if (openrouterKey) headers["x-openrouter-api-key"] = openrouterKey;

    const openrouterModel = cleanHeaderValue(settings.openrouterModel || "openrouter/free");
    if (openrouterModel) headers["x-openrouter-model"] = openrouterModel;

    const mistralKey = cleanHeaderValue(settings.mistralApiKey);
    if (mistralKey) headers["x-mistral-api-key"] = mistralKey;

    const mistralModel = cleanHeaderValue(settings.mistralModel || "mistral-small-latest");
    if (mistralModel) headers["x-mistral-model"] = mistralModel;

    const deepseekKey = cleanHeaderValue(settings.deepseekApiKey);
    if (deepseekKey) headers["x-deepseek-api-key"] = deepseekKey;

    const deepseekModel = cleanHeaderValue(settings.deepseekModel || "deepseek-v4-flash");
    if (deepseekModel) headers["x-deepseek-model"] = deepseekModel;

    const lmEndpoint = cleanHeaderValue(settings.lmStudioEndpoint || "http://localhost:1234/v1");
    if (lmEndpoint) headers["x-lm-studio-endpoint"] = lmEndpoint;

    const lmModel = cleanHeaderValue(settings.lmStudioModel || "local-model");
    if (lmModel) headers["x-lm-studio-model"] = lmModel;

    // Propagate generic headers dynamically so that backend can run provider-independently
    let activeKey = "";
    let activeModel = "";
    if (settings.provider === "openai") {
      activeKey = settings.openaiApiKey;
      activeModel = settings.openaiModel || "gpt-4o-mini";
    } else if (settings.provider === "cloud") {
      activeKey = settings.geminiApiKey;
      activeModel = settings.geminiModel || "gemini-2.0-flash";
    } else if (settings.provider === "groq") {
      activeKey = settings.groqApiKey;
      activeModel = settings.groqModel || "llama-3.3-70b-versatile";
    } else if (settings.provider === "openrouter") {
      activeKey = settings.openrouterApiKey;
      activeModel = settings.openrouterModel || "openrouter/free";
    } else if (settings.provider === "mistral") {
      activeKey = settings.mistralApiKey;
      activeModel = settings.mistralModel || "mistral-small-latest";
    } else if (settings.provider === "deepseek") {
      activeKey = settings.deepseekApiKey;
      activeModel = settings.deepseekModel || "deepseek-v4-flash";
    }

    const cleanActiveKey = cleanHeaderValue(activeKey);
    if (cleanActiveKey) headers["x-ai-api-key"] = cleanActiveKey;

    const cleanActiveModel = cleanHeaderValue(activeModel);
    if (cleanActiveModel) headers["x-ai-model"] = cleanActiveModel;

    return headers;
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
