export interface UserSettings {
  provider: "local" | "cloud" | "openai" | "groq" | "openrouter" | "mistral" | "deepseek";
  geminiApiKey: string;
  geminiModel?: string;
  openaiApiKey: string;
  openaiModel?: string;
  groqApiKey: string;
  groqModel?: string;
  openrouterApiKey: string;
  openrouterModel?: string;
  mistralApiKey: string;
  mistralModel?: string;
  deepseekApiKey: string;
  deepseekModel?: string;
  lmStudioEndpoint: string;
  lmStudioModel: string;
  theme: "theme-light" | "theme-dark" | "theme-sepia" | "theme-forest" | "theme-ocean";
}

const STORAGE_KEY = "prepagent_settings";

export const DEFAULT_SETTINGS: UserSettings = {
  provider: "local",
  geminiApiKey: "",
  geminiModel: "gemini-2.0-flash",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  groqApiKey: "",
  groqModel: "llama-3.3-70b-versatile",
  openrouterApiKey: "",
  openrouterModel: "openrouter/free",
  mistralApiKey: "",
  mistralModel: "mistral-small-latest",
  deepseekApiKey: "",
  deepseekModel: "deepseek-v4-flash",
  lmStudioEndpoint: "http://localhost:1234/v1",
  lmStudioModel: "local-model",
  theme: "theme-dark",
};

export function loadSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(data);
    
    // Map legacy light/dark to new theme classes
    if (parsed.theme === "light") parsed.theme = "theme-light";
    if (parsed.theme === "dark") parsed.theme = "theme-dark";
    
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    console.error("Error reading settings:", e);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    
    // Clear legacy and active theme classes
    const theme = settings.theme || "theme-dark";
    document.documentElement.classList.remove(
      "theme-light",
      "theme-dark",
      "theme-sepia",
      "theme-forest",
      "theme-ocean",
      "dark"
    );
    
    // Apply the active theme
    document.documentElement.classList.add(theme);
    
    // Add legacy tailwind fallback 'dark' class for all themes except theme-light
    if (theme !== "theme-light") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    console.error("Error saving settings:", e);
  }
}

function cleanHeaderValue(val: string | undefined | null): string {
  if (!val) return "";
  return val
    .trim()
    .replace(/[\r\n]/g, "")
    .replace(/[^\x20-\x7E]/g, ""); // Allow only printable ASCII characters
}

export function getAIHeaders(): Record<string, string> {
  const settings = loadSettings();
  const headers: Record<string, string> = {};

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
}

export const HARDCODED_SUBJECTS = [
  "History",
  "Geography",
  "Assam",
  "Polity",
  "Economics",
  "Environment",
  "Current Affairs",
  "Science & Tech",
  "Miscellaneous",
  "Extra"
];

