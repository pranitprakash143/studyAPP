/**
 * Shared SSE streaming utilities for AI provider responses.
 * Consolidates duplicate SSE parsing logic across API routes.
 */

import { NextResponse } from "next/server";

// ── Provider configuration extraction ──────────────────────────────────────

export interface AIProviderConfig {
  provider: string;
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

export interface ProviderEndpoint {
  apiKey: string;
  model: string;
  baseUrl: string;
  headers: Record<string, string>;
}

function cleanKey(val: string | undefined | null): string {
  return (val || "").trim().replace(/[\r\n]/g, "");
}

export function buildProviderConfig(config: AIProviderConfig): ProviderEndpoint {
  let apiKey = "";
  let model = "";
  let baseUrl = "";
  const headers: Record<string, string> = {};

  if (config.provider === "openai") {
    apiKey = cleanKey(config.openaiApiKey);
    model = config.openaiModel || "gpt-4o-mini";
    baseUrl = "https://api.openai.com/v1";
  } else if (config.provider === "groq") {
    apiKey = cleanKey(config.groqApiKey);
    model = config.groqModel || "llama-3.3-70b-versatile";
    baseUrl = "https://api.groq.com/openai/v1";
  } else if (config.provider === "openrouter") {
    apiKey = cleanKey(config.openrouterApiKey);
    model = config.openrouterModel || "openrouter/free";
    baseUrl = "https://openrouter.ai/api/v1";
    headers["HTTP-Referer"] = "http://localhost:3000";
    headers["X-Title"] = "PrepAgent";
  } else if (config.provider === "mistral") {
    apiKey = cleanKey(config.mistralApiKey);
    model = config.mistralModel || "mistral-small-latest";
    baseUrl = "https://api.mistral.ai/v1";
  } else if (config.provider === "deepseek") {
    apiKey = cleanKey(config.deepseekApiKey);
    model = config.deepseekModel || "deepseek-v4-flash";
    baseUrl = "https://api.deepseek.com";
  } else {
    apiKey = "";
    model = config.lmStudioModel || "local-model";
    baseUrl = config.lmStudioEndpoint || "http://localhost:1234/v1";
  }

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  return { apiKey, model, baseUrl, headers };
}

// ── SSE Pipeline: Gemini format ───────────────────────────────────────────

export function createGeminiSSEStream(
  response: Response
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = response.body?.getReader();

  return new ReadableStream({
    async start(controller) {
      if (!reader) {
        controller.close();
        return;
      }
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) {
              const dataStr = trimmed.substring(5).trim();
              try {
                const dataJson = JSON.parse(dataStr);
                const partText =
                  dataJson.candidates?.[0]?.content?.parts?.[0]?.text;
                if (partText) {
                  controller.enqueue(encoder.encode(partText));
                }
              } catch {
                /* ignore parse errors */
              }
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

// ── SSE Pipeline: OpenAI-compatible format ────────────────────────────────

export function createOpenAICompatibleSSEStream(
  response: Response
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = response.body?.getReader();

  return new ReadableStream({
    async start(controller) {
      if (!reader) {
        controller.close();
        return;
      }
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) {
              const dataStr = trimmed.substring(5).trim();
              if (dataStr === "[DONE]") continue;
              try {
                const dataJson = JSON.parse(dataStr);
                const deltaText = dataJson.choices?.[0]?.delta?.content;
                if (deltaText) {
                  controller.enqueue(encoder.encode(deltaText));
                }
              } catch {
                /* ignore parse errors */
              }
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

// ── Stream Response wrapper ────────────────────────────────────────────────

export function createStreamingResponse(
  stream: ReadableStream<Uint8Array>
): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

// ── Error response helper ──────────────────────────────────────────────────

export function streamErrorResponse(
  message: string,
  status: number = 500
): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

// ── Gemini API URL builder ─────────────────────────────────────────────────

export function buildGeminiStreamUrl(
  apiKey: string,
  model: string
): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
}
