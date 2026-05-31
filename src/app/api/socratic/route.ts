import { NextRequest, NextResponse } from "next/server";
import { getAIConfigFromRequest, generateText } from "@/lib/ai-provider";
import { queryKnowledgeBase } from "@/lib/backend-client";

export async function POST(req: NextRequest) {
  try {
    const config = getAIConfigFromRequest(req);
    const body = await req.json();
    const { topic, subjectFilter, history = [], round = 0, scores = [] } = body;

    if (!topic) {
      return NextResponse.json({ success: false, error: "Topic is required to start a Socratic session." }, { status: 400 });
    }

    // 1. Semantic retrieval from ChromaDB via FastAPI
    const searchResults = await queryKnowledgeBase(topic, subjectFilter, 6);
    if (searchResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No matching material found in your knowledge base for this topic. Please upload study files first!",
      }, { status: 404 });
    }

    const contextText = searchResults
      .map((r, i) => `[Chunk #${i + 1} | Topic: ${r.topic}]\n${r.content}`)
      .join("\n\n---\n\n");


    // ROUND 0: Session Initialization
    if (round === 0) {
      const systemPrompt = `You are a Socratic tutor. Your goal is to guide students to active recall understanding rather than lecturing them.
Your task is to review the provided context on the topic "${topic}" and formulate a single, high-yield introductory question.

Rules for your question:
1. The question must test core conceptual understanding, not trivial trivia.
2. The question must be completely answerable using ONLY the details present in the Context.
3. Make it engaging, challenging, and clear.
4. Output ONLY the question text, no surrounding text, no conversational wraps.`;

      const prompt = `Based strictly on this context, ask the first conceptual question about "${topic}".
Context:
--------------------------------
${contextText}
--------------------------------`;

      console.log("Socratic: Seeding initial question...");
      const question = await generateText(config, prompt, systemPrompt, false);

      const initialHistory = [{ role: "assistant", content: question.trim() }];
      return NextResponse.json({
        success: true,
        round: 1,
        question: question.trim(),
        history: initialHistory,
        scores: [],
      });
    }

    // ROUNDS 1-4: Mid-Session Grilling, Grading, & Feedback
    const latestUserMessage = history[history.length - 1]?.content || "";
    const lastQuestion = history[history.length - 2]?.content || "";

    if (round >= 1 && round <= 4) {
      const systemPrompt = `You are a Socratic coach holding an oral examination.
Evaluate the student's latest answer against the context and the question asked.

Your task is to return a JSON object with:
1. "score": An integer (0 to 100) grading the completeness, accuracy, and logic of their answer compared to the provided study context. Be honest but constructive.
2. "feedback": A brief feedback paragraph (2-3 sentences). Highlight what they explained correctly, what key terms/facts they omitted, and provide a helpful hint without giving away the final answers. Keep it highly supportive.
3. "nextQuestion": A follow-up question. This question must probe deeper, test their understanding of another sub-concept in the context, or dynamically guide them out of any logic flaws present in their answer.

Output strictly a JSON object with this schema:
{
  "score": 85,
  "feedback": "Great explanation of X! However, you forgot to mention Y. Hint: think about how Z affects it.",
  "nextQuestion": "Can you explain what happens when..."
}

Ensure you output ONLY the raw JSON object and nothing else. No markdown wraps, no extra text.`;

      const prompt = `Context:
--------------------------------
${contextText}
--------------------------------

Last Question Asked:
"${lastQuestion}"

Student's Recall Answer:
"${latestUserMessage}"

Grade their answer and formulate the next progressive question in JSON.`;

      console.log(`Socratic: Processing evaluation for Round ${round}...`);
      const aiReply = await generateText(config, prompt, systemPrompt, true);

      // Clean potential markdown blocks
      let cleanedReply = aiReply.trim();
      if (cleanedReply.startsWith("```json")) {
        cleanedReply = cleanedReply.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleanedReply.startsWith("```")) {
        cleanedReply = cleanedReply.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const payload = JSON.parse(cleanedReply);
      const score = Number(payload.score) || 0;
      const feedback = payload.feedback || "Thanks for your response. Let's continue.";
      const nextQuestion = payload.nextQuestion || "What is your next thought?";

      const updatedHistory = [
        ...history,
        { role: "assistant", content: nextQuestion }
      ];

      return NextResponse.json({
        success: true,
        round: round + 1,
        feedback,
        question: nextQuestion,
        history: updatedHistory,
        scores: [...scores, score],
      });
    }

    // ROUND 5: Final Evaluation & Mastery Mapping
    if (round === 5) {
      const systemPrompt = `You are a Socratic examiner conducting the final round of an oral exam.
Evaluate the student's final answer against the context and the question.
Then, compile a comprehensive Cognitive Mastery Summary of the entire session.

Your task is to return a JSON object with:
1. "score": An integer (0 to 100) grading their final recall answer.
2. "feedback": A brief closing feedback on their last answer.
3. "summary": A high-yield overview of their conceptual understanding of this topic.
4. "strengths": A JSON array of strings listing sub-concepts or key terms they explained perfectly.
5. "gaps": A JSON array of strings listing study gaps, logical flaws, or omitted details they struggled with.

Output strictly a JSON object with this schema:
{
  "score": 90,
  "feedback": "Perfect conclusion! You clearly grasped X.",
  "summary": "The student demonstrated a strong grasp of X and Y, showing minor gaps in understanding Z.",
  "strengths": [
    "Accurately recalled X process",
    "Understood key regulatory steps"
  ],
  "gaps": [
    "Struggled to detail secondary pathways",
    "Missed the temperature coefficient threshold"
  ]
}

Ensure you output ONLY the raw JSON object and nothing else. No markdown wraps, no extra text.`;

      const prompt = `Context:
--------------------------------
${contextText}
--------------------------------

Final Question Asked:
"${lastQuestion}"

Student's Recall Answer:
"${latestUserMessage}"

Perform the final evaluation and compile the Socratic Mastery Report in JSON.`;

      console.log("Socratic: Generating final Mastery Report...");
      const aiReply = await generateText(config, prompt, systemPrompt, true);

      // Clean potential markdown blocks
      let cleanedReply = aiReply.trim();
      if (cleanedReply.startsWith("```json")) {
        cleanedReply = cleanedReply.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleanedReply.startsWith("```")) {
        cleanedReply = cleanedReply.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const payload = JSON.parse(cleanedReply);
      const finalScore = Number(payload.score) || 0;
      const feedback = payload.feedback || "Thank you for completing the oral exam.";
      const summary = payload.summary || "You completed the oral exam on this topic.";
      const strengths = payload.strengths || [];
      const gaps = payload.gaps || [];

      const allScores = [...scores, finalScore];
      const overallMastery = Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length);

      return NextResponse.json({
        success: true,
        round: 6,
        feedback,
        scores: allScores,
        finalReport: {
          overallMastery,
          summary,
          strengths,
          gaps,
        }
      });
    }

    return NextResponse.json({ success: false, error: "Invalid round parameter." }, { status: 400 });
  } catch (error: any) {
    console.error("Socratic route crash:", error);
    return NextResponse.json({ success: false, error: error.message || "An unknown error occurred during Socratic session." }, { status: 500 });
  }
}
