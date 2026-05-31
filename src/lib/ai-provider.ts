import { NextRequest } from "next/server";

export interface AIProviderConfig {
  provider: "local" | "cloud" | "openai" | "groq" | "openrouter" | "mistral" | "deepseek";
  geminiApiKey?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  groqApiKey?: string;
  groqModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  mistralApiKey?: string;
  mistralModel?: string;
  deepseekApiKey?: string;
  deepseekModel?: string;
  lmStudioEndpoint?: string;
  lmStudioModel?: string;
}

export function getAIConfigFromRequest(req: NextRequest): AIProviderConfig {
  const serverApiKey = process.env.GEMINI_API_KEY;
  const defaultProvider = serverApiKey ? "cloud" : "local";

  const provider = (req.headers.get("x-ai-provider") || defaultProvider) as any;
  
  const geminiApiKey = req.headers.get("x-gemini-api-key") || serverApiKey || undefined;
  const geminiModel = req.headers.get("x-gemini-model") || "gemini-2.0-flash";
  
  const openaiApiKey = req.headers.get("x-openai-api-key") || process.env.OPENAI_API_KEY || undefined;
  const openaiModel = req.headers.get("x-openai-model") || "gpt-4o-mini";

  const groqApiKey = req.headers.get("x-groq-api-key") || process.env.GROQ_API_KEY || undefined;
  const groqModel = req.headers.get("x-groq-model") || "llama-3.3-70b-versatile";

  const openrouterApiKey = req.headers.get("x-openrouter-api-key") || process.env.OPENROUTER_API_KEY || undefined;
  const openrouterModel = req.headers.get("x-openrouter-model") || "openrouter/free";

  const mistralApiKey = req.headers.get("x-mistral-api-key") || process.env.MISTRAL_API_KEY || undefined;
  const mistralModel = req.headers.get("x-mistral-model") || "mistral-small-latest";

  const deepseekApiKey = req.headers.get("x-deepseek-api-key") || process.env.DEEPSEEK_API_KEY || undefined;
  const deepseekModel = req.headers.get("x-deepseek-model") || "deepseek-v4-flash";
  
  const lmStudioEndpoint = req.headers.get("x-lm-studio-endpoint") || "http://localhost:1234/v1";
  const lmStudioModel = req.headers.get("x-lm-studio-model") || "local-model";

  return {
    provider,
    geminiApiKey,
    geminiModel,
    openaiApiKey,
    openaiModel,
    groqApiKey,
    groqModel,
    openrouterApiKey,
    openrouterModel,
    mistralApiKey,
    mistralModel,
    deepseekApiKey,
    deepseekModel,
    lmStudioEndpoint,
    lmStudioModel,
  };
}

export async function generateText(
  config: AIProviderConfig,
  prompt: string,
  systemPrompt?: string,
  useJson: boolean = false
): Promise<string> {
  const openAICompatibleProviders = ["openai", "groq", "openrouter", "mistral", "deepseek"];

  if (openAICompatibleProviders.includes(config.provider)) {
    let apiKey = "";
    let model = "";
    let baseUrl = "";
    
    if (config.provider === "openai") {
      apiKey = config.openaiApiKey || "";
      model = config.openaiModel || "gpt-4o-mini";
      baseUrl = "https://api.openai.com/v1";
    } else if (config.provider === "groq") {
      apiKey = config.groqApiKey || "";
      model = config.groqModel || "llama-3.3-70b-versatile";
      baseUrl = "https://api.groq.com/openai/v1";
    } else if (config.provider === "openrouter") {
      apiKey = config.openrouterApiKey || "";
      model = config.openrouterModel || "openrouter/free";
      baseUrl = "https://openrouter.ai/api/v1";
    } else if (config.provider === "mistral") {
      apiKey = config.mistralApiKey || "";
      model = config.mistralModel || "mistral-small-latest";
      baseUrl = "https://api.mistral.ai/v1";
    } else if (config.provider === "deepseek") {
      apiKey = config.deepseekApiKey || "";
      model = config.deepseekModel || "deepseek-v4-flash";
      baseUrl = "https://api.deepseek.com";
    }

    if (!apiKey) {
      throw new Error(`API key is required for ${config.provider} mode. Please configure it in Settings.`);
    }

    const url = `${baseUrl.endsWith("/") ? baseUrl : baseUrl + "/"}chat/completions`;
    const messages: any[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const body: any = {
      model,
      messages,
      temperature: 0.2,
    };

    if (useJson) {
      body.response_format = { type: "json_object" };
    }

    let response;
    try {
      console.log(`[ai-provider] Making request to ${config.provider}: model=${body.model}, keyLength=${apiKey.length}`);
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      };

      if (config.provider === "openrouter") {
        headers["HTTP-Referer"] = "http://localhost:3000";
        headers["X-Title"] = "PrepAgent";
      }

      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        cache: "no-store",
      });
    } catch (fetchErr: any) {
      console.error(`[ai-provider] fetch to ${config.provider} failed:`, fetchErr);
      if (fetchErr.cause) {
        console.error(`[ai-provider] fetch failed cause details:`, fetchErr.cause);
      }
      throw new Error(`${config.provider} Connection Failed: ${fetchErr.message}. Cause: ${fetchErr.cause?.message || 'Check your internet connection or proxy settings.'}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${config.provider} API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (text === undefined || text === null) {
      throw new Error(`${config.provider} returned an empty response.`);
    }
    return text;
  } else if (config.provider === "cloud") {
    if (!config.geminiApiKey) {
      throw new Error("Gemini API key is required when in Cloud AI mode.");
    }
    const model = config.geminiModel || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;

    const contents: any[] = [];
    contents.push({
      role: "user",
      parts: [{ text: prompt }]
    });

    const body: any = {
      contents,
    };

    if (systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    if (useJson) {
      body.generationConfig = {
        responseMimeType: "application/json",
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini API returned an empty response.");
    }
    return text;
  } else {
    // Local mode: LM Studio OpenAI-compatible endpoint
    const endpoint = config.lmStudioEndpoint || "http://localhost:1234/v1";
    const url = `${endpoint.endsWith("/") ? endpoint : endpoint + "/"}chat/completions`;

    const messages: any[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const body: any = {
      model: config.lmStudioModel || "local-model",
      messages,
      temperature: 0.2,
    };

    if (useJson) {
      body.response_format = { type: "json_object" };
    }

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      if (err.cause?.code === 'ECONNREFUSED') {
        throw new Error(`Could not connect to local AI at ${endpoint}. Please ensure LM Studio is running and the Local Server is started on port 1234.`);
      }
      throw new Error(`Failed to connect to local AI: ${err.message}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (text === undefined || text === null) {
      throw new Error("LM Studio returned an empty response.");
    }
    return text;
  }
}

export async function embedText(config: AIProviderConfig, text: string): Promise<number[]> {
  const openAICompatibleProviders = ["openai", "groq", "openrouter", "mistral", "deepseek"];

  if (openAICompatibleProviders.includes(config.provider)) {
    // Embeddings fallback: try Gemini first if key available
    if (config.geminiApiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${config.geminiApiKey}`;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text }] }
          }),
        });
        if (response.ok) {
          const data = await response.json();
          return data.embedding?.values || new Array(3072).fill(0);
        }
      } catch (e) {
        console.error("Gemini fallback embedding failed:", e);
      }
    }

    // Try OpenAI fallback next
    const openaiKey = config.openaiApiKey || (config.provider === "openai" ? config.openaiApiKey : undefined);
    if (openaiKey) {
      const url = "https://api.openai.com/v1/embeddings";
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: text,
          }),
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          return data.data?.[0]?.embedding || new Array(1536).fill(0);
        }
      } catch (e) {
        console.error("OpenAI fallback embedding failed:", e);
      }
    }

    // Standard zero vector fallback
    return new Array(768).fill(0);
  } else if (config.provider === "cloud") {
    if (!config.geminiApiKey) {
      throw new Error("Gemini API key is required when in Cloud AI mode.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${config.geminiApiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: {
          parts: [{ text }]
        }
      }),
    });

    if (!response.ok) {
      console.error("Gemini Embedding failed, returning empty vector");
      return new Array(3072).fill(0);
    }

    const data = await response.json();
    return data.embedding?.values || new Array(3072).fill(0);
  } else {
    return [];
  }
}
