import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest } from "@/lib/ai-provider";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);
    const body = await req.json();
    const { text, style, customInstruction } = body;

    if (!text) {
      return NextResponse.json(
        { success: false, error: "Text to restructure is required." },
        { status: 400 }
      );
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
        return NextResponse.json(
          { success: false, error: "Gemini API key is required when in Cloud AI mode." },
          { status: 400 }
        );
      }

      const model = config.geminiModel || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${config.geminiApiKey}`;

      const contents = [{
        role: "user",
        parts: [{ text: prompt }]
      }];

      const requestBody: any = {
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      };

      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
      } catch (err: any) {
        console.error("Fetch error to Gemini API:", err);
        return NextResponse.json(
          { success: false, error: `Failed to connect to Gemini API: ${err.message}` },
          { status: 500 }
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { success: false, error: `Gemini Stream API error: ${errorText}` },
          { status: response.status }
        );
      }

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = response.body?.getReader();

      const customStream = new ReadableStream({
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
                    const partText = dataJson.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (partText) {
                      controller.enqueue(encoder.encode(partText));
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            }
          } catch (error: any) {
            console.error("Gemini stream reading error:", error);
            controller.error(error);
          } finally {
            reader.releaseLock();
            controller.close();
          }
        }
      });

      return new Response(customStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
        },
      });

    } else {
      // 2. Local Mode (LM Studio OpenAI compatible stream)
      const endpoint = config.lmStudioEndpoint || "http://localhost:1234/v1";
      const url = `${endpoint.endsWith("/") ? endpoint : endpoint + "/"}chat/completions`;

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ];

      const requestBody = {
        model: config.lmStudioModel || "local-model",
        messages,
        temperature: 0.2,
        stream: true,
      };

      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
      } catch (err: any) {
        console.error("Fetch error to Local AI API:", err);
        if (err.cause?.code === 'ECONNREFUSED') {
          return NextResponse.json(
            { success: false, error: `Could not connect to local AI at ${endpoint}. Please ensure LM Studio is running and the Local Server is started on port 1234.` },
            { status: 500 }
          );
        }
        return NextResponse.json(
          { success: false, error: `Failed to connect to local AI: ${err.message}` },
          { status: 500 }
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { success: false, error: `LM Studio Stream error: ${errorText}` },
          { status: response.status }
        );
      }

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = response.body?.getReader();

      const customStream = new ReadableStream({
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
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            }
          } catch (error: any) {
            console.error("LM Studio stream reading error:", error);
            controller.error(error);
          } finally {
            reader.releaseLock();
            controller.close();
          }
        }
      });

      return new Response(customStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
        },
      });
    }

  } catch (error: any) {
    console.error("[Next.js POST /api/notes/restructure/stream]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
