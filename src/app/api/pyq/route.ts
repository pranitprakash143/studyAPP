import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest, generateText, AIProviderConfig } from "@/lib/ai-provider";
import { createWorker } from "tesseract.js";
import fs from "fs";
import path from "path";

// Provide a dummy polyfill for DOMMatrix to prevent pdf-parse from crashing in Node environments
if (typeof global !== "undefined" && typeof (global as any).DOMMatrix === "undefined") {
  (global as any).DOMMatrix = class DOMMatrix {};
}

// Process Gemini Multimodal OCR (sends base64 image directly to Gemini)
async function processGeminiOcr(config: AIProviderConfig, buffer: Buffer, mimeType: string): Promise<string> {
  if (!config.geminiApiKey) {
    throw new Error("Gemini API key required for Multimodal OCR.");
  }
  const base64Data = buffer.toString("base64");
  const model = config.geminiModel || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: "You are an expert exam and question paper transcription scanner. Transcribe all text (including questions, choices, answers, numbers, formulas) present in this image clearly. Output only the exact transcribed text, maintain original layout structures, and correct spelling errors."
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Multimodal OCR error: ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini Multimodal OCR returned empty transcript.");
  }
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const pastedQuestions = formData.get("pastedQuestions") as string;
    const subject = (formData.get("subject") as string) || "General Studies";

    let pyqText = "";
    let sourceName = "";

    if (file) {
      sourceName = file.name;
      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.name.endsWith(".pdf")) {
        try {
          const pdfParse = require("pdf-parse");
          const parsedPdf = await pdfParse(buffer);
          pyqText = parsedPdf.text || "";
        } catch (pdfErr) {
          console.error("PDF parse failure:", pdfErr);
          return NextResponse.json({ success: false, error: "Failed to parse PYQ PDF." }, { status: 500 });
        }
      } else if (file.type.startsWith("image/")) {
        // Scanned paper OCR
        if (config.provider === "cloud") {
          try {
            console.log("Running cloud Gemini Multimodal OCR on PYQ image...");
            pyqText = await processGeminiOcr(config, buffer, file.type);
          } catch (cloudOcrErr: any) {
            console.error("Cloud Gemini OCR failed:", cloudOcrErr);
            return NextResponse.json({ success: false, error: `Cloud OCR failed: ${cloudOcrErr.message}` }, { status: 500 });
          }
        } else {
          // Local Mode OCR using CDN-backed Tesseract worker
          try {
            console.log("Running local CDN-backed Tesseract OCR on PYQ image...");
            const worker = await createWorker("eng", 1, {
              workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist/worker.min.js",
              langPath: "https://tessdata.projectnaptha.com/4.0.0",
              corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/tesseract-core.wasm.js",
            });
            const { data: { text } } = await worker.recognize(buffer);
            await worker.terminate();
            pyqText = text || "";
          } catch (ocrErr: any) {
            console.error("Local Tesseract OCR failed:", ocrErr);
            return NextResponse.json({ 
              success: false, 
              error: `Local OCR failed: ${ocrErr.message}. Please connect to the internet or paste the text directly.` 
            }, { status: 500 });
          }
        }
      } else {
        return NextResponse.json({ success: false, error: "Unsupported PYQ file type. Please upload a PDF or Image." }, { status: 400 });
      }
    } else if (pastedQuestions) {
      sourceName = `Pasted_Questions_${Date.now().toString().slice(-4)}`;
      pyqText = pastedQuestions;
    } else {
      return NextResponse.json({ success: false, error: "No input provided. Upload a file or paste questions." }, { status: 400 });
    }

    pyqText = pyqText.trim();
    if (!pyqText) {
      return NextResponse.json({ success: false, error: "No text could be extracted from the PYQ paper." }, { status: 400 });
    }

    // Prompt LLM to extract Q&A and clean the layout
    const systemPrompt = `You are a curriculum distillation bot.
Your job is to read raw text from a Previous Year Question (PYQ) paper (which might contain typos, scanner noise, and formatting clutter) and extract a highly structured, clean Markdown document listing all the exam questions and answers.

Format the output strictly as a clean Markdown section:
## Exam Paper: ${sourceName} (Ingested on ${new Date().toLocaleDateString()})

For each question:
### Question [Number]: [Clean Question Title]
- **Distilled Question**: [Full question text, clearly structured. Include multiple-choice options A, B, C, D if present]
- **Estimated Answer / Key Explanation**: [Suggest the correct answer, or outline a clear, step-by-step resolution/explanation if it is a descriptive or mathematical question]

Output ONLY the raw markdown text. Do NOT wrap it in backticks like \`\`\`markdown, do NOT include introductory conversational sentences. Just start with '## Exam Paper:'.`;

    const prompt = `Distill all exam questions and answers from the following raw text.
Subject: ${subject}
Source Name: ${sourceName}

Raw Extracted Text:
---
${pyqText.slice(0, 32000)}
---`;

    console.log("Synthesizing Q&A via AI provider...");
    const aiReply = await generateText(config, prompt, systemPrompt, false);

    // Ensure directory exists
    const pyqsDir = path.join(process.cwd(), "knowledge_base", "pyqs");
    if (!fs.existsSync(pyqsDir)) {
      fs.mkdirSync(pyqsDir, { recursive: true });
    }

    const safeSubject = subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const pyqFilePath = path.join(pyqsDir, `${safeSubject}_pyqs.md`);

    // Append if existing, otherwise write
    let finalMarkdown = "";
    if (fs.existsSync(pyqFilePath)) {
      const existingContent = fs.readFileSync(pyqFilePath, "utf-8");
      finalMarkdown = `${existingContent}\n\n---\n\n${aiReply.trim()}`;
    } else {
      finalMarkdown = `# PYQ Bank: ${subject}\n\nThis document acts as the source of truth for all Previous Year Questions in ${subject}.\n\n${aiReply.trim()}`;
    }

    fs.writeFileSync(pyqFilePath, finalMarkdown, "utf-8");
    console.log(`Saved PYQ bank to ${pyqFilePath}`);

    return NextResponse.json({
      success: true,
      source: sourceName,
      subject,
      markdown: aiReply.trim(),
    });
  } catch (error: any) {
    console.error("PYQ processing failed:", error);
    return NextResponse.json({ success: false, error: error.message || "An unknown error occurred during PYQ processing." }, { status: 500 });
  }
}

// DELETE /api/pyq?fileName=fileName
// Deletes a specific PYQ bank file from knowledge base
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("fileName");

    if (!fileName) {
      return NextResponse.json({ success: false, error: "fileName parameter is required." }, { status: 400 });
    }

    // Direct path safety check to avoid directory traversal
    const safeFileName = path.basename(fileName);
    if (!safeFileName.endsWith(".md")) {
      return NextResponse.json({ success: false, error: "Only Markdown PYQ banks can be deleted." }, { status: 400 });
    }

    const pyqFilePath = path.join(process.cwd(), "knowledge_base", "pyqs", safeFileName);

    if (fs.existsSync(pyqFilePath)) {
      fs.unlinkSync(pyqFilePath);
      console.log(`Deleted PYQ bank file: ${pyqFilePath}`);
      return NextResponse.json({ success: true, message: `PYQ Bank file '${safeFileName}' deleted successfully.` });
    } else {
      return NextResponse.json({ success: false, error: "PYQ Bank file not found." }, { status: 404 });
    }
  } catch (error: any) {
    console.error("DELETE PYQ failed:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to delete PYQ bank." }, { status: 500 });
  }
}

