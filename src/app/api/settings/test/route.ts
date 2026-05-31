import "@/lib/logger"; // Ensure console logger is imported and registered
import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest, generateText } from "@/lib/ai-provider";

export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);
    console.log(`[Test Connection API] Starting test for provider: ${config.provider}`);
    if (config.provider === "cloud") {
      console.log(`[Test Connection API] Configured Gemini model: ${config.geminiModel}`);
      console.log(`[Test Connection API] API Key length: ${config.geminiApiKey?.length || 0}`);
    } else {
      console.log(`[Test Connection API] Configured Local Endpoint: ${config.lmStudioEndpoint}`);
    }
    
    // Perform a quick test query
    let reply = "";
    try {
      reply = await generateText(
        config,
        "Say exactly the word 'CONNECTED' and nothing else.",
        "You are a connection testing assistant."
      );
      console.log(`[Test Connection API] Success! Response from LLM: "${reply.trim()}"`);
    } catch (genError: any) {
      console.error("[Test Connection API] generateText failed, fetching available models...", genError);
      if (config.provider === "cloud" && config.geminiApiKey) {
        try {
          const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.geminiApiKey}`;
          const listRes = await fetch(listUrl);
          if (listRes.ok) {
            const listData = await listRes.json();
            const modelNames = listData.models?.map((m: any) => m.name) || [];
            throw new Error(`${genError.message}. Available models: ${modelNames.join(", ")}`);
          }
        } catch (listError: any) {
          console.error("Failed to list models:", listError);
        }
      }
      throw genError;
    }

    return NextResponse.json({
      success: true,
      message: reply.trim(),
      provider: config.provider,
    });
  } catch (error: any) {
    console.error("Connection test failed:", error);
    if (error.cause) {
      console.error("[Test Connection API] Underlying fetch error cause:", error.cause);
    }
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unknown error occurred during connection test.",
      },
      { status: 500 }
    );
  }
}
