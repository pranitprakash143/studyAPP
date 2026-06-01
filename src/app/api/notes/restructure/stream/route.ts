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
    const body = await req.json();
    const { text, style, customInstruction } = body;

    if (!text) {
      return streamErrorResponse("Text to restructure is required.", 400);
    }

    const systemPrompt = `You are an expert academic editor, text restructuring engine, and strict factual preservation guard.
Your sole purpose is to take a raw segment of student study notes, resolve any OCR or formatting errors, and restructure it to maximize readability, retention, and visual appeal.

Follow these strict, non-negotiable rules:
1. STRICT ANTI-HALLUCINATION: Rely ONLY on the facts, concepts, dates, numbers, calculations, names, and definitions present in the provided notes. DO NOT add any outside facts, external knowledge, or unverified details under any circumstances. 
2. ZERO FACTUAL LOSS & ABSOLUTE TEXT PRESERVATION: You are strictly forbidden from removing, omitting, or altering any original fact, date, term, calculation, name, or core concept. You are cleaning up errors, formatting, and organization, NOT deleting academic details or simplifying concepts out of existence. Factual completeness is paramount; every single piece of data, relationship, and terminology in the original text must be 100% preserved in the output.
3. CONCISE SENTENCE REORGANIZATION: Compress and reorganize the sentences to be extremely concise. Eliminate verbose wordiness, repetitive filler, and grammatical noise. Shorten absolute word and character counts without losing an atom of informational content.
4. RIGID HEADING PRESERVATION:
   - YOU MUST PRESERVE all existing subtopic headings (lines starting with '### ') EXACTLY as they are provided in the input, without changing a single character, casing, punctuation, or spacing of the heading. You are strictly forbidden from deleting, renaming, or merging headings.
   - DO NOT generate or include the main chapter heading (lines starting with '## ') in your output under any circumstances. Restructure ONLY the body content under each heading.
5. EXTREME VISUAL LAYOUTS: Whenever appropriate, convert the cleaned text into premium study structures:
   - Markdown comparison tables if comparing two or more entities
   - High-yield structured bullet lists with nested sub-bullets for causes, features, or effects
   - Step-by-step timelines or flows for sequential processes
   - Key Facts callout boxes using markdown blockquotes (e.g. "> ⚡ Key Revision Fact: ...")
6. Preserve Academic Terminology: Maintain all exact academic and technical terminologies, proper nouns, and numbers.
7. Output Format: Return ONLY the restructured markdown segment. Do not write introductory text, conversational greetings, pleasantries, or explanations. Start immediately with the restructured markdown.`;

    let prompt = `Restructure the following segment of study notes:
"${text}"

Target Layout Format Style: ${style || "bullets"}
${customInstruction ? `Specific formatting instruction to apply: "${customInstruction}"` : ""}

Generate the beautifully organized, factually correct, and structured markdown now:`;

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
        console.error("Fetch error to Gemini API:", err);
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
      console.error(`Fetch error to ${config.provider} API:`, err);
      const message = err instanceof Error ? err.message : "Unknown error";
      if (config.provider === "local" && err instanceof Error && (err.cause as { code?: string })?.code === "ECONNREFUSED") {
        const endpoint = config.lmStudioEndpoint || "http://localhost:1234/v1";
        return streamErrorResponse(
          `Could not connect to local AI at ${endpoint}. Please ensure LM Studio is running and the Local Server is started on port 1234.`
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
    console.error("[Next.js POST /api/notes/restructure/stream]", message);
    return streamErrorResponse(message);
  }
}
