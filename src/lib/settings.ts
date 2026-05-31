export interface UserSettings {
  provider: "local" | "cloud";
  geminiApiKey: string;
  geminiModel?: string;
  lmStudioEndpoint: string;
  lmStudioModel: string;
  theme: "theme-light" | "theme-dark" | "theme-sepia" | "theme-forest" | "theme-ocean";
}

const STORAGE_KEY = "prepagent_settings";

export const DEFAULT_SETTINGS: UserSettings = {
  provider: "local",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
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

  const geminiModel = cleanHeaderValue(settings.geminiModel || "gemini-2.5-flash");
  if (geminiModel) headers["x-gemini-model"] = geminiModel;

  const lmEndpoint = cleanHeaderValue(settings.lmStudioEndpoint || "http://localhost:1234/v1");
  if (lmEndpoint) headers["x-lm-studio-endpoint"] = lmEndpoint;

  const lmModel = cleanHeaderValue(settings.lmStudioModel || "local-model");
  if (lmModel) headers["x-lm-studio-model"] = lmModel;

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

