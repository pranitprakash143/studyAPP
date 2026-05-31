"use client";

import { useState } from "react";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import LoadingState from "@/components/LoadingState";
import ErrorAlert from "@/components/ErrorAlert";
import StatusBadge from "@/components/StatusBadge";
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  Loader2,
  BookOpen,
  MessageSquare,
  AlertTriangle,
  Award,
  CheckCircle,
  ThumbsUp,
  BrainCircuit,
  CornerDownRight,
  TrendingUp,
} from "lucide-react";
import { getAIHeaders, HARDCODED_SUBJECTS } from "@/lib/settings";
import CustomDropdown from "@/components/CustomDropdown";

type SessionState = "setup" | "active" | "report";

interface Message {
  role: "assistant" | "user";
  content: string;
}

interface SocraticReport {
  overallMastery: number;
  summary: string;
  strengths: string[];
  gaps: string[];
}

export default function SocraticSeminar() {
  const [sessionState, setSessionState] = useState<SessionState>("setup");
  
  const subjectOptions = HARDCODED_SUBJECTS.map((sub) => ({
    value: sub,
    label: sub,
    icon: "📚",
  }));
  
  // Setup parameters
  const [subject, setSubject] = useState(HARDCODED_SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"normal" | "hardcore">("normal");
  const [errorMsg, setErrorMsg] = useState("");

  // Active Session states
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState<Message[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [latestFeedback, setLatestFeedback] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  // Final Report states
  const [finalReport, setFinalReport] = useState<SocraticReport | null>(null);
  
  // Gaps patching states
  const [patchingGaps, setPatchingGaps] = useState<Record<string, boolean>>({});
  const [patchedGaps, setPatchedGaps] = useState<Record<string, boolean>>({});

  // 1. Initialize Socratic session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !topic.trim()) {
      setErrorMsg("Subject and Topic are required to start a Socratic seminar.");
      return;
    }

    setErrorMsg("");
    setLoading(true);
    setRound(0);
    setHistory([]);
    setScores([]);
    setLatestFeedback("");
    setFinalReport(null);
    setPatchedGaps({});

    try {
      const res = await fetch("/api/socratic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          topic: topic.trim(),
          subjectFilter: subject.trim(),
          round: 0,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRound(data.round);
        setHistory(data.history);
        setSessionState("active");
      } else {
        setErrorMsg(data.error || "Failed to initialize Socratic Coach. Check if files are uploaded for this topic.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to contact Socratic Coach service.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit user answer
  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || loading) return;

    const updatedHistory: Message[] = [
      ...history,
      { role: "user", content: userAnswer.trim() }
    ];

    setHistory(updatedHistory);
    setUserAnswer("");
    setLoading(true);

    try {
      const res = await fetch("/api/socratic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          topic: topic.trim(),
          subjectFilter: subject.trim(),
          round: round,
          history: updatedHistory,
          scores: scores,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.round <= 5) {
          // Progress dialogue
          setRound(data.round);
          setScores(data.scores);
          setLatestFeedback(data.feedback);
          setHistory(data.history);
        } else {
          // Complete and show report!
          setScores(data.scores);
          setLatestFeedback(data.feedback);
          setFinalReport(data.finalReport);
          setSessionState("report");
        }
      } else {
        setErrorMsg(data.error || "Failed to process your response.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to contact Socratic Coach.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Patch Gap Quick Action
  const handlePatchGap = async (gapText: string) => {
    setPatchingGaps(prev => ({ ...prev, [gapText]: true }));

    try {
      // 1. Call Notes API to generate summary for this specific gap
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          query: `Synthesize detailed high-yield revision notes for this Socratic study gap: "${gapText}"`,
          subjectFilter: subject.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // 2. Ingest notes to Master KB
        const ingestRes = await fetch("/api/ingest", {
          method: "POST",
          headers: getAIHeaders(),
          body: new URLSearchParams({
            subject: subject.trim(),
            topic: `${topic.trim()} - Gap Patched`,
            pastedText: data.notes,
          }),
        });

        if (ingestRes.ok) {
          setPatchedGaps(prev => ({ ...prev, [gapText]: true }));
        }
      }
    } catch (err) {
      console.error("Failed to patch study gap:", err);
    } finally {
      setPatchingGaps(prev => ({ ...prev, [gapText]: false }));
    }
  };

  const handleRestart = () => {
    setSessionState("setup");
    setErrorMsg("");
  };

  return (
    <PageLayout maxWidth="6xl">
      <PageHeader
        icon={<GraduationCap className="h-6 w-6" />}
        title="Socratic Seminars Room"
        description="Active Recall Coach. Engage in conceptual oral exams, spot understanding gaps, and build cognitive mastery."
      />

        {/* 1. SETUP SESSION SCREEN */}
        {sessionState === "setup" && (
          <form
            onSubmit={handleStartSession}
            className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md p-6 max-w-2xl mx-auto space-y-6"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <BrainCircuit className="h-5 w-5 text-indigo-500 animate-pulse" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Seminar Settings</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">Target Subject</label>
                <CustomDropdown
                  options={subjectOptions}
                  value={subject}
                  onChange={setSubject}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Concept / Topic to Test</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Photosynthesis, Limits"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-slate-800 dark:text-white"
                  required
                />
              </div>
            </div>

            {/* Seminar Rigor Selection */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Coach Rigor / Difficulty</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setDifficulty("normal")}
                  className={`p-4 rounded-xl border text-left flex flex-col gap-1 transition ${
                    difficulty === "normal"
                      ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20 text-slate-800 dark:text-white"
                      : "border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900/30 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <span className="font-extrabold text-sm flex items-center gap-1.5">
                    <ThumbsUp className="h-4 w-4 text-emerald-500" /> Supportive Socratic
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                    Tutor offers conceptual hints, highlights vocabulary misses, and guides you gently.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty("hardcore")}
                  className={`p-4 rounded-xl border text-left flex flex-col gap-1 transition ${
                    difficulty === "hardcore"
                      ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20 text-slate-800 dark:text-white"
                      : "border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900/30 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <span className="font-extrabold text-sm flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-500 animate-pulse" /> Hardcore Auditor
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                    Tutor audits logic strictly, expects exact recall, and points out gaps aggressively.
                  </span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-4 bg-rose-500/5 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 transition cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Gathering Study Materials...
                </>
              ) : (
                <>
                  Enter Socratic Seminars <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* 2. ACTIVE ORAL arena */}
        {sessionState === "active" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Chat Screen */}
            <div className="lg:col-span-2 flex flex-col bg-white dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden min-h-[550px] relative">
              {/* Top status bar */}
              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-300">
                    Socratic Session: <span className="text-indigo-500">{topic}</span>
                  </span>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500">
                  Round {round} of 5
                </span>
              </div>

              {/* Chat Log history */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[360px]">
                {history.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 ${
                      msg.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        msg.role === "user"
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          : "bg-indigo-500/10 text-indigo-500"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <BookOpen className="h-4 w-4" />
                      ) : (
                        <GraduationCap className="h-4 w-4" />
                      )}
                    </div>

                    <div className="max-w-[85%] flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {msg.role === "user" ? "Your Response" : "Socratic Coach"}
                      </span>
                      <div
                        className={`p-4 rounded-2xl text-sm leading-relaxed border ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                            : "bg-slate-50/50 dark:bg-[#151c2f]/45 text-slate-800 dark:text-slate-200 border-slate-100 dark:border-slate-800"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Socratic Coach is evaluating...
                      </span>
                      <div className="p-4 rounded-2xl text-sm bg-slate-50/50 dark:bg-[#151c2f]/20 border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 italic">
                        Measuring recall accuracy and preparing dynamic hints...
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              <form
                onSubmit={handleSubmitAnswer}
                className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-[#111726]/30 flex items-center gap-3 relative"
              >
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={loading}
                  placeholder="Explain your understanding of this concept here..."
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c101b] text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-slate-800 dark:text-white"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 text-white rounded-xl shadow-md shadow-indigo-500/5 transition cursor-pointer"
                >
                  <ArrowRight className="h-4.5 w-4.5" />
                </button>
              </form>
            </div>

            {/* Right Diagnostic Feedback Panel */}
            <div className="space-y-6">
              {/* Dynamic Hints Panel */}
              <div className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md p-6 relative">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Active Coach Feedback</h3>
                </div>

                {latestFeedback ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic bg-slate-50/50 dark:bg-[#151c2f]/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      "{latestFeedback}"
                    </p>
                    {difficulty === "normal" && (
                      <div className="flex items-start gap-2 text-[10px] text-amber-500 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 leading-relaxed font-medium">
                        <CornerDownRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>Use the tutor's hint to expand your answer and target exact keywords!</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed italic text-center py-6">
                    Awaiting your first recall response. The Socratic coach will analyze your logic and display real-time feedback and hints here.
                  </p>
                )}
              </div>

              {/* Progress Box */}
              <div className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md p-6">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Seminar Progress</h3>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Active Recall Score</span>
                  <span className="font-extrabold text-indigo-500">{scores.length > 0 ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%` : "Awaiting Grader"}</span>
                </div>
                {/* Horizontal Round Nodes */}
                <div className="flex items-center justify-between gap-1.5 mt-4">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <div
                      key={item}
                      className={`flex-1 h-2 rounded-full transition-all duration-200 ${
                        round > item
                          ? "bg-emerald-500"
                          : round === item
                          ? "bg-indigo-500 animate-pulse"
                          : "bg-slate-200 dark:bg-slate-800"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 mt-4 leading-relaxed">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  <span>Each recall response is graded out of 100 on correctness and logic.</span>
                </div>
              </div>

              <button
                onClick={handleRestart}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs font-bold text-slate-600 dark:text-slate-300 transition cursor-pointer"
              >
                Quit Seminar
              </button>
            </div>
          </div>
        )}

        {/* 3. FINAL MASTERY REPORT DASHBOARD */}
        {sessionState === "report" && finalReport && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Radial circular Mastery score card */}
            <div className="bg-white/95 dark:bg-[#111726]/85 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md p-6 flex flex-col md:flex-row items-center gap-8">
              {/* Radial score gauge */}
              <div className="relative h-32 w-32 shrink-0 flex items-center justify-center bg-indigo-500/5 dark:bg-[#151c2f]/20 rounded-full border border-indigo-500/10">
                <svg className="absolute transform -rotate-90 w-28 h-28">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100 dark:text-slate-800"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - finalReport.overallMastery / 100)}
                    className="text-indigo-500 transition-all duration-1000"
                  />
                </svg>
                <div className="text-center">
                  <span className="text-3xl font-black text-slate-800 dark:text-white block leading-none">{finalReport.overallMastery}%</span>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mt-1">Mastery</span>
                </div>
              </div>

              {/* Verbal summary */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-500" />
                  <h2 className="font-extrabold text-xl text-slate-900 dark:text-white">
                    Cognitive Concept Mastery Profile
                  </h2>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {finalReport.summary}
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                    <TrendingUp className="h-3.5 w-3.5 text-indigo-500" /> average grade: {finalReport.overallMastery}/100
                  </div>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={handleRestart}
                className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-600 text-white font-extrabold text-xs shrink-0 transition shadow-sm cursor-pointer"
              >
                Restart New Seminar
              </button>
            </div>

            {/* Strengths vs Gaps Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cognitive Strengths Card */}
              <div className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md p-6">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 mb-4">
                  <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Conceptual Strengths</h3>
                </div>
                <ul className="space-y-3">
                  {finalReport.strengths.map((str, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cognitive Gaps Card (Featuring quick patching action!) */}
              <div className="bg-white/80 dark:bg-[#111726]/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md p-6">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 mb-4">
                  <AlertTriangle className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Identified Study Gaps</h3>
                </div>
                <div className="space-y-4">
                  {finalReport.gaps.map((gap, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-900 group hover:border-indigo-500/30 transition duration-150"
                    >
                      <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                        <span>{gap}</span>
                      </div>

                      {patchedGaps[gap] ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 shrink-0">
                          <CheckCircle className="h-3.5 w-3.5" /> Patched
                        </span>
                      ) : (
                        <button
                          onClick={() => handlePatchGap(gap)}
                          disabled={patchingGaps[gap]}
                          className="px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-500 font-extrabold text-[9px] uppercase tracking-wider shrink-0 transition disabled:bg-slate-200 cursor-pointer"
                        >
                          {patchingGaps[gap] ? (
                            <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                          ) : (
                            "Patch Gap"
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
    </PageLayout>
  );
}
