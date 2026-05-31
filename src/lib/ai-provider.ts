import { NextRequest } from "next/server";

export interface AIProviderConfig {
  provider: "local" | "cloud";
  geminiApiKey?: string;
  geminiModel?: string;
  lmStudioEndpoint?: string;
  lmStudioModel?: string;
}

export function getAIConfigFromRequest(req: NextRequest): AIProviderConfig {
  const provider = (req.headers.get("x-ai-provider") || "local") as "local" | "cloud";
  const geminiApiKey = req.headers.get("x-gemini-api-key") || undefined;
  const geminiModel = req.headers.get("x-gemini-model") || "gemini-2.5-flash";
  const lmStudioEndpoint = req.headers.get("x-lm-studio-endpoint") || "http://localhost:1234/v1";
  const lmStudioModel = req.headers.get("x-lm-studio-model") || "local-model";

  return {
    provider,
    geminiApiKey,
    geminiModel,
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
  if (config.provider === "cloud") {
    if (!config.geminiApiKey) {
      throw new Error("Gemini API key is required when in Cloud AI mode.");
    }
    // We use user-configured model (defaults to gemini-2.5-flash)
    const model = config.geminiModel || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;

    const contents: any[] = [];
    if (systemPrompt) {
      // For Gemini, system instructions go in a separate field in the request body
    }

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
  if (config.provider === "cloud") {
    if (!config.geminiApiKey) {
      throw new Error("Gemini API key is required when in Cloud AI mode.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${config.geminiApiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: {
          parts: [{ text }]
        }
      }),
    });

    if (!response.ok) {
      // Graceful fallback to zero vector if embedding fails
      console.error("Gemini Embedding failed, returning empty vector");
      return new Array(768).fill(0);
    }

    const data = await response.json();
    return data.embedding?.values || new Array(768).fill(0);
  } else {
    // In local mode, we will fall back to a local JS calculation in the vector store
    // to avoid requiring the user to run an embedding server in LM Studio.
    return [];
  }
}
