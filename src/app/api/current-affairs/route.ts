import { NextRequest } from "next/server";
import { getAIConfigFromRequest } from "@/lib/ai-provider";
import {
  buildProviderConfig,
  buildGeminiStreamUrl,
  createGeminiSSEStream,
  createOpenAICompatibleSSEStream,
  createStreamingResponse,
  streamErrorResponse,
} from "@/lib/stream-utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);

    const systemPrompt = `You are a Current Affairs Curator for exam preparation (UPSC, APSC, state PCS, competitive exams).
Your task is to generate a curated list of recent, high-yield current affairs news items.

Cover these sources:
- India: The Hindu, Indian Express, Economic Times, PIB
- Assam: The Assam Tribune, NorthEast Now, Sentinel Assam
- World: Reuters, BBC, The Guardian, Al Jazeera

For each news item, provide:
1. A clear, concise headline (formatted as **headline**)
2. A 2-3 sentence summary
3. Source and exam relevance on the same line
4. A highly descriptive 3-5 word keyword search term for an illustrative stock photo (formatted as ImageQuery: text)

Format your response using EXACTLY this structure (use these exact section headers):

## 🇮🇳 India

### [Category Name]
**Headline**: text
Summary: text
Source: text | Exam: text
ImageQuery: text

(Repeat for each item. Use categories like: Polity & Governance, Economy, Environment, Science & Tech, International Relations, National Security, Social Issues)

## 🇮🇳 Assam

### [Category Name]
**Headline**: text
Summary: text
Source: text | Exam: text
ImageQuery: text

## 🌍 World

### [Category Name]
**Headline**: text
Summary: text
Source: text | Exam: text
ImageQuery: text

Generate 6-8 items for India, 4-5 for Assam, and 4-5 for World. Prioritize recent developments, government schemes, bills, international summits, environmental news, and economic indicators.`;

    const prompt = `Generate today's current affairs digest covering top news from Indian national newspapers, Assam-specific news, and major world events. Focus on exam-relevant developments.`;

    // 1. Cloud Mode (Gemini API)
    if (config.provider === "cloud") {
      if (!config.geminiApiKey) {
        return streamErrorResponse("Gemini API key is required when in Cloud AI mode.", 400);
      }

      const model = config.geminiModel || "gemini-2.5-flash";
      const url = buildGeminiStreamUrl(config.geminiApiKey, model);

      const contents = [{
        role: "user",
        parts: [{ text: prompt }]
      }];

      const requestBody: Record<string, unknown> = {
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      };

      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return streamErrorResponse(`Failed to connect to Gemini API: ${message}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        return streamErrorResponse(`Gemini Stream API error: ${errorText}`, response.status);
      }

      const stream = createGeminiSSEStream(response);
      return createStreamingResponse(stream);
    }

    // 2. OpenAI-compatible providers + LM Studio
    const providerConfig = buildProviderConfig(config);
    const url = `${providerConfig.baseUrl.endsWith("/") ? providerConfig.baseUrl : providerConfig.baseUrl + "/"}chat/completions`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ];

    const requestBody: Record<string, unknown> = {
      model: providerConfig.model,
      messages,
      temperature: 0.2,
      stream: true,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...providerConfig.headers,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (err instanceof Error && (err.cause as { code?: string })?.code === "ECONNREFUSED") {
        return streamErrorResponse(
          `Could not connect to local AI at ${providerConfig.baseUrl}. Please ensure LM Studio is running.`
        );
      }
      return streamErrorResponse(`Failed to connect to ${config.provider}: ${message}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return streamErrorResponse(
        `${config.provider} Stream error (${response.status}): ${errorText}`,
        response.status
      );
    }

    const stream = createOpenAICompatibleSSEStream(response);
    return createStreamingResponse(stream);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[current-affairs stream]", message);
    return streamErrorResponse(message);
  }
}
