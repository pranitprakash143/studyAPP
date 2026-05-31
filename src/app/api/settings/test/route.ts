import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest, generateText } from "@/lib/ai-provider";

export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);
    
    // Perform a quick test query
    let reply = "";
    try {
      reply = await generateText(
        config,
        "Say exactly the word 'CONNECTED' and nothing else.",
        "You are a connection testing assistant."
      );
    } catch (genError: any) {
      console.error("generateText failed, fetching available models...", genError);
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
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unknown error occurred during connection test.",
      },
      { status: 500 }
    );
  }
}
