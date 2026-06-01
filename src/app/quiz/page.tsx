"use client";

import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import {
  Award,
  BookOpen,
  HelpCircle,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Search,
} from "lucide-react";
import { getAIHeaders, HARDCODED_SUBJECTS } from "@/lib/settings";
import CustomDropdown from "@/components/CustomDropdown";

interface MCQQuestion {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  answer: "A" | "B" | "C" | "D";
  explanation: string;
}

interface Stats {
  subjects: string[];
}

export default function Quiz() {
  const [stats, setStats] = useState<Stats | null>(null);
  
  const subjectFilterOptions = [
    { value: "All", label: "All Subjects", icon: "🌐" },
    ...HARDCODED_SUBJECTS.map((sub) => ({
      value: sub,
      label: sub,
      icon: "📚",
    })),
  ];

  // Setup options
  const [topic, setTopic] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [count, setCount] = useState(5);

  // Quiz state
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, "A" | "B" | "C" | "D">>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/notes", {
          method: "GET",
          headers: getAIHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setStats(data.stats);
          }
        }
      } catch (e) {
        console.error("Failed to load quiz statistics:", e);
      }
    }
    loadStats();
  }, []);

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setGenerating(true);
    setErrorMsg("");
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers({});
    setShowExplanation({});
    setQuizFinished(false);

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          topic,
          subjectFilter: subjectFilter === "All" ? undefined : subjectFilter,
          count,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setQuestions(data.questions);
      } else {
        setErrorMsg(data.error || "RAG engine could not extract facts to generate quiz.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to contact quiz generator API.");
    } finally {
      setGenerating(false);
    }
  };

  const handleOptionClick = (option: "A" | "B" | "C" | "D") => {
    if (answers[currentIndex]) return; // Answer already selected for this question
    
    setAnswers({ ...answers, [currentIndex]: option });
    setShowExplanation({ ...showExplanation, [currentIndex]: true });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleRestart = () => {
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers({});
    setShowExplanation({});
    setQuizFinished(false);
  };

  const score = Object.entries(answers).reduce((acc, [idxStr, ans]) => {
    const idx = Number(idxStr);
    return acc + (ans === questions[idx].answer ? 1 : 0);
  }, 0);

  return (
    <PageLayout maxWidth="4xl">
      <PageHeader
        icon={<Award className="h-6 w-6" />}
        title="Active Recall Quiz Engine"
        description="Test your understanding. Quizzes are generated strictly from details present in your syllabus folder."
      />

        {/* Dynamic Quiz Frame */}
        <div className="flex-1 flex flex-col justify-center">
          {generating ? (
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-12 text-center flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Compiling Syllabus Facts...</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm leading-relaxed">
                PrepAgent is searching the vector store, extracting relevant statements from your files, and generating a rigorous custom quiz.
              </p>
            </div>
          ) : errorMsg ? (
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-12 text-center flex flex-col items-center gap-4">
              <XCircle className="h-12 w-12 text-rose-500" />
              <h2 className="text-xl font-bold text-rose-500">Quiz Generation Failed</h2>
              <p className="text-sm text-slate-500 max-w-sm">{errorMsg}</p>
              <button
                onClick={() => setErrorMsg("")}
                className="mt-4 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100"
              >
                Go Back
              </button>
            </div>
          ) : questions.length === 0 ? (
            /* Setup Screen */
            <form
              onSubmit={handleGenerateQuiz}
              className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-8 max-w-2xl mx-auto w-full space-y-6"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quiz Customization</h2>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Target Study Topic</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-slate-400 h-4.5 w-4.5" />
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Photosynthesis, Mughal Administration"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 mb-0.5">Filter by Subject</label>
                  <CustomDropdown
                    options={subjectFilterOptions}
                    value={subjectFilter}
                    onChange={setSubjectFilter}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">Questions Count</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/40 text-sm focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!topic.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-sm py-3 rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 transition"
              >
                Compile MCQ Quiz <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : quizFinished ? (
            /* Score Summary Screen */
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-8 max-w-md mx-auto w-full text-center space-y-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Evaluation Complete</h2>

              {/* Radial circle representation */}
              <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    strokeWidth="10"
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    strokeWidth="10"
                    strokeDasharray={377}
                    strokeDashoffset={377 - (377 * score) / questions.length}
                    strokeLinecap="round"
                    stroke="currentColor"
                    className="text-indigo-500 transition-all duration-1000 ease-out"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{score}</span>
                  <span className="text-slate-400 text-sm block">/ {questions.length}</span>
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-200 mt-2">
                  {score === questions.length
                    ? "Perfect Score! 🌟"
                    : score / questions.length >= 0.7
                    ? "Excellent understanding! 👍"
                    : "Good effort! Keep reviewing! 📚"}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Your results have been synthesized based strictly on target factual citations. Review the question cards below if needed.
                </p>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleRestart}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> New Quiz
                </button>
              </div>
            </div>
          ) : (
            /* Quiz Active Player Card */
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm p-6 max-w-2xl mx-auto w-full space-y-6 relative overflow-hidden">
              {/* Top Progress bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>

              {/* Status header */}
              <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 shrink-0 font-bold uppercase tracking-wider pt-2">
                <span>Topic: {topic}</span>
                <span>
                  Question {currentIndex + 1} of {questions.length}
                </span>
              </div>

              {/* Question Text */}
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-relaxed mt-2">
                {questions[currentIndex].question}
              </h2>

              {/* Options Grid */}
              <div className="grid grid-cols-1 gap-3 mt-4">
                {(Object.keys(questions[currentIndex].options) as Array<"A" | "B" | "C" | "D">).map((key) => {
                  const optionText = questions[currentIndex].options[key];
                  const isSelected = answers[currentIndex] === key;
                  const isCorrect = questions[currentIndex].answer === key;
                  const hasAnswered = !!answers[currentIndex];

                  let buttonStyle = "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300";
                  let Icon = null;

                  if (hasAnswered) {
                    if (isCorrect) {
                      buttonStyle = "border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-bold scale-[1.01]";
                      Icon = CheckCircle;
                    } else if (isSelected) {
                      buttonStyle = "border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400 font-bold";
                      Icon = XCircle;
                    } else {
                      buttonStyle = "border-slate-100 dark:border-slate-900 text-slate-300 dark:text-slate-600 opacity-60";
                    }
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => handleOptionClick(key)}
                      disabled={hasAnswered}
                      className={`w-full p-4 rounded-xl border text-left text-sm flex items-center justify-between gap-4 transition-all duration-200 ${buttonStyle}`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}>
                          {key}
                        </span>
                        <span>{optionText}</span>
                      </span>
                      {Icon && <Icon className="h-5 w-5 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Citated Explanation pop-up */}
              {showExplanation[currentIndex] && (
                <div className="bg-slate-50 dark:bg-[#0b0f19]/40 border border-slate-100 dark:border-slate-800 p-4 rounded-xl text-xs leading-relaxed space-y-1.5 transition-all duration-300">
                  <div className="flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wide">
                    <HelpCircle className="h-4 w-4" /> Explanation & Source
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    {questions[currentIndex].explanation}
                  </p>
                </div>
              )}

              {/* Control Panel */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-6 shrink-0">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Prev
                </button>

                <button
                  onClick={handleNext}
                  disabled={!answers[currentIndex]}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-500 font-semibold text-xs transition flex items-center gap-1.5 shadow-sm"
                >
                  {currentIndex === questions.length - 1 ? "Finish Evaluation" : "Next Question"}{" "}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
    </PageLayout>
  );
}
