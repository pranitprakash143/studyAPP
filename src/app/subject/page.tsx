"use client";

import React, { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import {
  Edit3,
  Loader2,
  Network,
  X
} from "lucide-react";
import { getAIHeaders, HARDCODED_SUBJECTS } from "@/lib/settings";
import { formatDisplayName } from "@/lib/utils";

import ReactFlowGraph from "@/components/ReactFlowGraph";
import GraphErrorBoundary from "@/components/GraphErrorBoundary";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import TiptapEditor from "@/components/TiptapEditor";

import { cleanAiMarkdownArtifacts } from "@/lib/subject/cleaner";
import { parseTopics } from "@/lib/subject/toc-parser";
import { getFontFamily } from "@/lib/subject/font-utils";
import { downloadDocx, downloadMarkdown, printPdf } from "@/lib/subject/export-utils";
import ExportModal from "@/components/subject/ExportModal";
import NotificationBanners from "@/components/subject/NotificationBanners";
import SelectionHud from "@/components/subject/SelectionHud";
import AnnotationPopup from "@/components/subject/AnnotationPopup";
import SocraticPopup from "@/components/subject/SocraticPopup";
import TTSPlayerPill from "@/components/subject/TTSPlayerPill";
import UndoToast from "@/components/subject/UndoToast";
import RestructureModal from "@/components/subject/RestructureModal";
import SandboxCompareModal from "@/components/subject/SandboxCompareModal";
import SubjectHeader from "@/components/subject/SubjectHeader";
import TocSidebar from "@/components/subject/TocSidebar";
import AiAssistantPanel from "@/components/subject/AiAssistantPanel";
import FocusMode from "@/components/subject/FocusMode";
import PreviewPanel from "@/components/subject/PreviewPanel";
import type { TopicNode } from "@/lib/subject/types";

export default function SubjectBinder() {
  const [subject, setSubject] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [topics, setTopics] = useState<TopicNode[]>([]);

  // --- Dynamic Client-Side TOC Parser useMemo ---
  const parsedTOC = React.useMemo(() => {
    if (!markdown) return [];
    
    const lines = markdown.split("\n");
    const chaptersList: { name: string; fullName: string; sources: string[]; subsections: { name: string; fullName: string }[] }[] = [];
    let currentChapter: typeof chaptersList[0] | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 1. Chapter Heading (H1 new format, or H2 legacy Topic: format)
      if ((line.startsWith("# ") && !line.startsWith("# Subject:")) || line.startsWith("## Topic:")) {
        const fullName = line.startsWith("## Topic:")
          ? line.substring(9).trim()
          : line.substring(2).trim();
        const cleanName = fullName.replace(/^Topic:\s*/i, "").trim();
        
        currentChapter = {
          name: cleanName,
          fullName: fullName,
          sources: [],
          subsections: []
        };
        chaptersList.push(currentChapter);
        continue;
      }
      
      // 2. Sources descriptor (immediately below chapter heading)
      if (currentChapter && line.startsWith("* **Sources**:")) {
        const sourcesStr = line.replace("* **Sources**:", "").trim();
        if (sourcesStr) {
          currentChapter.sources = sourcesStr.split(",").map(s => s.trim()).filter(Boolean);
        }
        continue;
      }
      
      // 3. Subheading (H2 new format, or H3 legacy format)
      if (currentChapter && ((line.startsWith("## ") && !line.startsWith("## Topic:")) || line.startsWith("### "))) {
        const fullName = line.startsWith("### ")
          ? line.substring(4).trim()
          : line.substring(3).trim();
        const cleanName = fullName.replace(/^Topic:\s*/i, "").trim();
        currentChapter.subsections.push({
          name: cleanName,
          fullName: fullName
        });
      }
    }
    
    return chaptersList;
  }, [markdown]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);
  const [taskProgress, setTaskProgress] = useState(0);
  const [taskNode, setTaskNode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingMindmap, setLoadingMindmap] = useState(false);
  const [fixingLinks, setFixingLinks] = useState(false);

  // Layout states
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "split" | "visual" | "mindmap">("preview");

  // --- Sidebar TOC Renaming States ---
  const [editingTopicName, setEditingTopicName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [activeChapterFilter, setActiveChapterFilter] = useState<string>("All");
  const [isCleaningChapter, setIsCleaningChapter] = useState(false);
  const [selectedChapterName, setSelectedChapterName] = useState<string>("");
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(true);
  const [cleanStyle, setCleanStyle] = useState<"bullets" | "summary" | "table" | "timeline">("bullets");

  // Reading enhancements
  const [fontSize, setFontSize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [letterSpacing, setLetterSpacing] = useState(0.008);
  const [wordSpacing, setWordSpacing] = useState(0.04);
  const [focusMode, setFocusMode] = useState(false);

  // Mindmap state
  const [mindmapData, setMindmapData] = useState<{ nodes: any[], links: any[] } | null>(null);
  const [isDark, setIsDark] = useState(false);
  

  // Highlights, Selection, & Interactive Notes States
  const [highlights, setHighlights] = useState<any[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"chapters" | "highlights">("chapters");
  
  // Annotation notes comment popup
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotationText, setAnnotationText] = useState("");

  // AI Restructuring Drawer State
  const [isRestructuring, setIsRestructuring] = useState(false);
  const [restructureStyle, setRestructureStyle] = useState("bullets");
  const [restructureCustom, setRestructureCustom] = useState("");
  const [restructuredText, setRestructuredText] = useState("");
  const [generatingRestructure, setGeneratingRestructure] = useState(false);

  // --- New Sandbox, Previews & History States ---
  const [restructurePreviewText, setRestructurePreviewText] = useState("");
  const [originalTextBackup, setOriginalTextBackup] = useState("");
  const [notesHistoryBackup, setNotesHistoryBackup] = useState<string | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [isSandboxPreviewing, setIsSandboxPreviewing] = useState(false);
  const [restructureContext, setRestructureContext] = useState<{
    targetChapter: string;
    beforeText: string;
    afterText: string;
    chapterHeader: string;
    hasSources: boolean;
    sourcesLine: string;
  } | null>(null);

  // Socratic Explainer State
  const [socraticText, setSocraticText] = useState("");
  const [socraticAnswer, setSocraticAnswer] = useState("");
  const [loadingSocratic, setLoadingSocratic] = useState(false);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  // --- Text-to-Speech (TTS) & Export States & Hooks ---
  const {
    isPlaying,
    isPaused,
    currentBlockIndex,
    voices,
    selectedVoice,
    speechRate,
    play: handlePlayTTS,
    pause: handlePauseTTS,
    stop: handleStopTTS,
    setVoice: handleVoiceChange,
    setRate: handleRateChange,
    speakBlock,
  } = useSpeechSynthesis(markdown);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // --- Typography & Width States & Google Fonts Loader ---
  const [activeFont, setActiveFont] = useState("garamond");
  const [pageWidth, setPageWidth] = useState(820);
  const [showReaderPrefs, setShowReaderPrefs] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Architects+Daughter&family=Cinzel:wght@400..900&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      try {
        document.head.removeChild(link);
      } catch (e) {
        console.warn("Failed to clean up font stylesheet:", e);
      }
    };
  }, []);

  const handleDownloadDocx = () => {
    downloadDocx(subject, markdown);
  };



  const handlePrintPdf = () => {
    setIsExportModalOpen(false);
    printPdf(subject, markdown, activeFont, getFontFamily(activeFont));
  };

  // Monitor dark mode class on document element
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    setIsDark(document.documentElement.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });

    return () => observer.disconnect();
  }, []);

    // Center and fit the graph after loading or activeTab change
  useEffect(() => {
  }, [mindmapData, activeTab]);

  // Fetch highlights from DB for current subject
  const fetchHighlights = async (subjName: string) => {
    try {
      const res = await fetch(`/api/highlights?subject=${encodeURIComponent(subjName)}`);
      const data = await res.json();
      if (data.success) {
        setHighlights(data.highlights || []);
      }
    } catch (e) {
      console.error("Failed to load highlights:", e);
    }
  };

  // Text selection detection inside note preview
  const handleTextSelection = () => {
    if (typeof window === "undefined") return;
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      // Keep selection toolbar open even after clicking outside, until user explicitly clears it!
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 0) {
      const range = selection.getRangeAt(0);
      const container = previewContainerRef.current;
      
      // Ensure selection is inside preview container
      if (container && container.contains(range.commonAncestorContainer)) {
        setSelectedText(text);
        setPopoverPosition({ top: 0, left: 0 }); // Fixed Top position indicator
      }
    }
  };

  // Save selected text highlight to DB
  const handleSaveHighlight = async (color: "yellow" | "green" | "pink" | "blue", noteText?: string) => {
    if (!selectedText) return;

    // Clear user selection on screen
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }

    try {
      const res = await fetch("/api/highlights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          topic: topics[0]?.name || "General",
          text: selectedText,
          color,
          note: noteText || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setHighlights(prev => [...prev, data.highlight]);
        
        // Reset states
        setSelectedText("");
        setPopoverPosition(null);
        setIsAnnotating(false);
        setAnnotationText("");
      }
    } catch (e) {
      console.error("Failed to save highlight:", e);
    }
  };

  // Delete highlight from DB
  const handleDeleteHighlight = async (id: string) => {
    try {
      const res = await fetch(`/api/highlights?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setHighlights(prev => prev.filter(h => h.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete highlight:", e);
    }
  };

  // AI Restructuring Call
  const handleRestructureQuery = async () => {
    if (!selectedText) return;
    setGeneratingRestructure(true);
    setRestructuredText("");
    setIsRestructuring(true);
    
    try {
      const res = await fetch("/api/notes/restructure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          text: selectedText,
          style: restructureStyle,
          customInstruction: restructureCustom,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRestructuredText(data.restructured);
      } else {
        alert(data.error || "Failed to restructure notes segment.");
      }
    } catch (e: any) {
      console.error("Restructure request failed:", e);
      alert(e.message || "Failed to connect to restructure service.");
    } finally {
      setGeneratingRestructure(false);
    }
  };

  // Apply restructured markdown into active note markdown state & save
  const handleApplyRestructure = async () => {
    if (!selectedText || !restructuredText) return;
    
    // Alphanumeric sliding window search to locate selections ignoring markdown tags
    // Robust 4-Stage selection matching search algorithm to locate browser selections in raw markdown
    const findMarkdownTextRange = (md: string, sel: string): { startIdx: number; endIdx: number } | null => {
      if (!sel || !sel.trim()) return null;
      const trimmedSel = sel.trim();
      
      // Stage 1: Exact Match (Fastest & perfect for plain text)
      const exactIdx = md.indexOf(trimmedSel);
      if (exactIdx !== -1) {
        return { startIdx: exactIdx, endIdx: exactIdx + trimmedSel.length };
      }

      // Pre-extract words with indices from raw markdown for stages 2, 3, and 4
      interface WordToken {
        word: string;
        start: number;
        end: number;
      }
      const mdWords: WordToken[] = [];
      const wordRegex = /[a-z0-9]+/gi;
      let match;
      while ((match = wordRegex.exec(md)) !== null) {
        mdWords.push({
          word: match[0].toLowerCase(),
          start: match.index,
          end: match.index + match[0].length
        });
      }

      const selWords = trimmedSel.toLowerCase().match(/[a-z0-9]+/g) || [];
      if (selWords.length === 0) return null;

      // Stage 2: Strict Consecutive Word Sequence Match (Ignores formatting markdown like *, **, `, etc.)
      for (let i = 0; i <= mdWords.length - selWords.length; i++) {
        let isMatch = true;
        for (let j = 0; j < selWords.length; j++) {
          if (mdWords[i + j].word !== selWords[j]) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) {
          return {
            startIdx: mdWords[i].start,
            endIdx: mdWords[i + selWords.length - 1].end
          };
        }
      }

      // Stage 3: Greedy Ordered Word Search (Allows intervening characters/words like URLs inside markdown links [Text](url))
      let bestWindow = { startIdx: -1, endIdx: -1, score: 0, length: Infinity };
      const maxSkipped = 15; // Allow up to 15 skipped words (e.g. url segments or format markers)

      for (let i = 0; i < mdWords.length; i++) {
        let selIdx = 0;
        let mdIdx = i;
        let skipped = 0;
        
        while (selIdx < selWords.length && mdIdx < mdWords.length && skipped <= maxSkipped) {
          if (mdWords[mdIdx].word === selWords[selIdx]) {
            selIdx++;
          } else {
            skipped++;
          }
          mdIdx++;
        }
        
        if (selIdx === selWords.length) {
          const windowLength = mdIdx - i;
          const score = selWords.length / windowLength;
          if (score > bestWindow.score || (score === bestWindow.score && windowLength < bestWindow.length)) {
            bestWindow = {
              startIdx: mdWords[i].start,
              endIdx: mdWords[mdIdx - 1].end,
              score: score,
              length: windowLength
            };
          }
        }
      }

      if (bestWindow.score > 0 && bestWindow.score >= 0.5) {
        return { startIdx: bestWindow.startIdx, endIdx: bestWindow.endIdx };
      }

      // Stage 4: Fuzzy Sliding Window Word Overlap Match (Best-effort fallback for slightly modified selections)
      let bestFuzzy = { startIdx: -1, endIdx: -1, score: 0 };
      const windowSize = Math.max(selWords.length, 5);

      for (let i = 0; i <= mdWords.length - windowSize; i++) {
        const windowWords = mdWords.slice(i, i + windowSize);
        const windowWordSet = new Set(windowWords.map(w => w.word));
        
        let matchCount = 0;
        selWords.forEach(w => {
          if (windowWordSet.has(w)) matchCount++;
        });
        
        const score = matchCount / selWords.length;
        if (score > bestFuzzy.score && score >= 0.6) {
          bestFuzzy = {
            startIdx: mdWords[i].start,
            endIdx: windowWords[windowWords.length - 1].end,
            score: score
          };
        }
      }

      if (bestFuzzy.score >= 0.6) {
        return { startIdx: bestFuzzy.startIdx, endIdx: bestFuzzy.endIdx };
      }

      return null;
    };

    const range = findMarkdownTextRange(markdown, selectedText);
    if (!range) {
      alert("Could not locate the selected text in the original notes markdown. It might have been modified.");
      return;
    }

    // Save history backup for instant Undo capability
    setNotesHistoryBackup(markdown);

    const updatedMarkdown = 
      markdown.substring(0, range.startIdx) + 
      restructuredText + 
      markdown.substring(range.endIdx);

    setMarkdown(updatedMarkdown);

    // Close restructure workspace
    setIsRestructuring(false);
    setRestructuredText("");
    setSelectedText("");
    setPopoverPosition(null);

    // Show visual undo notification toast
    setShowUndoToast(true);
    setTimeout(() => {
      setShowUndoToast(false);
    }, 10000);

    // Auto-save the notes back to DB/vector store immediately to persist
    setTimeout(async () => {
      setSaving(true);
      setSaveSuccess(false);
      setErrorMessage("");
      try {
        const res = await fetch("/api/subject", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAIHeaders(),
          },
          body: JSON.stringify({
            subject,
            markdown: updatedMarkdown,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        } else {
          setErrorMessage(data.error || "Failed to save restructured note.");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Error saving restructured note.");
      } finally {
        setSaving(false);
      }
    }, 100);
  };

  // Socratic Explanation Call
  const handleSocraticQuery = async () => {
    if (!selectedText) return;
    setLoadingSocratic(true);
    setSocraticAnswer("");
    setSocraticText(selectedText);
    
    try {
      const res = await fetch("/api/notes/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          text: selectedText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSocraticAnswer(data.explanation);
      } else {
        alert(data.error || "Failed to retrieve Socratic explanation.");
      }
    } catch (e: any) {
      console.error("Socratic request failed:", e);
      alert(e.message || "Failed to connect to explanation service.");
    } finally {
      setLoadingSocratic(false);
    }
  };

  // Initialize and load notes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const subj = params.get("subject");
      const activeSubj = subj || HARDCODED_SUBJECTS[0];
      setSubject(activeSubj);
      fetchSubjectNotesWithProcessing(activeSubj);
      loadMindmap(activeSubj);
      fetchHighlights(activeSubj);
    }
  }, []);

  // Poll task progress when processing is running
  useEffect(() => {
    if (!processingTaskId || !processing) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks/${processingTaskId}`);
        const task = await res.json();
        if (task.progress !== undefined) setTaskProgress(task.progress);
        if (task.current_node) setTaskNode(task.current_node);
        if (
          task.status === "completed" ||
          task.status === "completed_with_errors"
        ) {
          clearInterval(interval);
          setProcessingTaskId(null);
          setProcessing(false);
          fetchSubjectNotes(subject);
        } else if (task.status === "failed" || task.status === "cancelled") {
          clearInterval(interval);
          setProcessingTaskId(null);
          setProcessing(false);
          setErrorMessage(
            task.error || "Processing failed or was cancelled."
          );
        }
      } catch {
        // wait for next poll
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [processingTaskId, processing, subject]);

  const fetchSubjectNotes = async (subjName: string) => {
    setLoading(true);
    setProcessing(false);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/subject?subject=${encodeURIComponent(subjName)}`, {
        method: "GET",
        headers: getAIHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.status === "processing") {
          setProcessing(true);
          setProcessingTaskId(data.task_id);
          setLoading(false);
          return;
        }
        if (data.status === "processing_error") {
          setErrorMessage("Processing completed with some errors.");
        }
        setMarkdown(data.markdown);
        setTopics(data.topics || []);
      } else {
        setErrorMessage(data.error || "Failed to load subject notes.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error loading subject notes.");
    } finally {
      setLoading(false);
      setProcessing(false);
    }
  };

  const fetchSubjectNotesWithProcessing = async (subjName: string) => {
    setProcessing(true);
    await fetchSubjectNotes(subjName);
  };

  const loadMindmap = async (subjName: string) => {
    setLoadingMindmap(true);
    try {
      const res = await fetch(`/api/mindmaps?subject=${encodeURIComponent(subjName)}`);
      const data = await res.json();
      if (data.success && data.graphs) {
        let combinedNodes: any[] = [];
        let combinedEdges: any[] = [];
        const nodeIds = new Set();
        data.graphs.forEach((g: any) => {
          g.nodes.forEach((n: any) => {
            if (!nodeIds.has(n.id)) {
              combinedNodes.push(n);
              nodeIds.add(n.id);
            }
          });
          g.edges.forEach((e: any) => combinedEdges.push(e));
        });
        if (combinedNodes.length > 0) {
          setMindmapData({ nodes: combinedNodes, links: combinedEdges });
        }
      }
    } catch (err) {
      console.error("Failed to load mindmap", err);
    } finally {
      setLoadingMindmap(false);
    }
  };

  const handleGenerateMindmap = async () => {
    if (parsedTOC.length === 0) {
      setErrorMessage("No topics available to generate mindmap.");
      return;
    }
    
    setLoadingMindmap(true);
    setErrorMessage("");
    try {
      // Split the raw markdown notes by chapter (# new format or ## Topic: legacy format)
      const normalizedMarkdown = markdown
        .replace(/^##\s+/gm, "\n## ")
        .replace(/^# /gm, "\n# ");
      const markdownBlocks = normalizedMarkdown.split(/\n(?=# |## Topic:)/);
      const chapterContentMap: Record<string, string> = {};
      
      // Parse each chapter section (skip first block which is before first heading)
      for (let i = 1; i < markdownBlocks.length; i++) {
        const block = markdownBlocks[i];
        const newlineIdx = block.indexOf("\n");
        const heading = newlineIdx === -1 ? block.trim() : block.substring(0, newlineIdx).trim();
        const content = newlineIdx === -1 ? "" : block.substring(newlineIdx).trim();
        
        const cleanHeading = heading.replace(/^## Topic:\s*/i, "").replace(/^#\s*/, "").trim();
        chapterContentMap[cleanHeading] = content;
        chapterContentMap[heading] = content;
      }

      // Generate mindmap for each topic
      for (const topic of parsedTOC) {
        // Retrieve chapter content from our parsed map, or use full markdown as fallback
        const topicContent = chapterContentMap[topic.name] || chapterContentMap[topic.fullName] || markdown;
        
        await fetch("/api/mindmaps/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            subject, 
            topic: topic.name,
            content: topicContent 
          })
        });
      }
      
      // Reload mindmap
      await loadMindmap(subject);
    } catch (err: any) {
      console.error("Failed to generate mindmaps:", err);
      setErrorMessage(err.message || "Failed to generate mindmaps");
    } finally {
      setLoadingMindmap(false);
    }
  };

  // Handle deleting a specific chapter (topic)
  const handleDeleteTopic = async (topicName: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete the chapter "${topicName}"? This will delete all its notes and mindmap nodes.`)) {
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`/api/subject?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topicName)}`, {
        method: "DELETE",
        headers: getAIHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Reload notes and mindmap
        fetchSubjectNotes(subject);
        loadMindmap(subject);
      } else {
        setErrorMessage(data.error || "Failed to delete chapter.");
      }
    } catch (e: any) {
      console.error("Failed to delete chapter:", e);
      setErrorMessage(e.message || "Failed to delete chapter.");
    } finally {
      setLoading(false);
    }
  };

  // Re-parse Table of Contents topics in real-time as editor text changes
  useEffect(() => {
    setTopics(parseTopics(markdown));
  }, [markdown]);

  // Synchronise selectedChapterName default value with parsedTOC
  useEffect(() => {
    if (parsedTOC.length > 0 && !selectedChapterName) {
      setSelectedChapterName(parsedTOC[0].name);
    }
  }, [parsedTOC, selectedChapterName]);

  // Handle saving notes back to vector store
  const handleSaveNotes = async () => {
    if (saving) return;
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage("");

    try {
      const res = await fetch("/api/subject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          subject,
          markdown,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMessage(data.error || "Failed to save subject notes.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error while saving notes.");
    } finally {
      setSaving(false);
    }
  };

  // Download raw notes file
  const handleDownloadMarkdown = () => {
    downloadMarkdown(subject, markdown);
  };



  // Scroll to selected topic heading inside the rendered preview
  const handleScrollToTopic = (fullName: string, topicName: string) => {
    let tabChanged = false;
    if (activeTab !== "preview" && activeTab !== "split") {
      setActiveTab("preview");
      tabChanged = true;
    }

    const scrollTask = () => {
      // Track selected chapter for Clean Chapter button when clicking sidebar topic links
      const matchedParent = parsedTOC.find(t => 
        t.name === topicName || 
        t.fullName === fullName || 
        t.subsections?.some(sub => sub.name === topicName || sub.fullName === fullName)
      );
      if (matchedParent) {
        setSelectedChapterName(matchedParent.name);
      }

      // Adaptive Chapter Filtering for preview/split modes
      let filterChanged = false;
      if (activeChapterFilter !== "All") {
        if (matchedParent && activeChapterFilter !== matchedParent.name) {
          setActiveChapterFilter(matchedParent.name);
          filterChanged = true;
        }
      }

      const performScroll = () => {
        if (previewContainerRef.current) {
          const escapedFull = encodeURIComponent(fullName);
          const escapedShort = encodeURIComponent(topicName);
          let targetElement = previewContainerRef.current.querySelector(`[data-topic-id="${escapedFull}"]`);
          if (!targetElement) {
            targetElement = previewContainerRef.current.querySelector(`[data-topic-id="${escapedShort}"]`);
          }
          if (!targetElement) {
            const cleanTopic = topicName.startsWith("Topic:") ? topicName.replace("Topic:", "").trim() : topicName;
            const escapedClean = encodeURIComponent(cleanTopic);
            targetElement = previewContainerRef.current.querySelector(`[data-topic-id="${escapedClean}"]`);
          }
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      };

      if (filterChanged) {
        // Wait for React to re-render the single chapter view before scrolling
        setTimeout(performScroll, 80);
      } else {
        performScroll();
      }
    };

    if (tabChanged) {
      setTimeout(scrollTask, 120);
    } else {
      scrollTask();
    }
  };

  // Stream clean/restructuring for the active filtered chapter
  const handleCleanChapter = async (targetChapter: string) => {
    if (!targetChapter || !markdown || isCleaningChapter) return;

    const lines = markdown.split("\n");
    let startLineIdx = -1;
    let endLineIdx = lines.length;

    // Find the exact chapter header line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === `## Topic: ${targetChapter}` || line === `## ${targetChapter}` || line === `# ${targetChapter}`) {
        startLineIdx = i;
        break;
      }
    }

    if (startLineIdx === -1) {
      // Fuzzy match fallback
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if ((line.startsWith("# ") && !line.startsWith("# Subject:")) || line.startsWith("## Topic:") || line.startsWith("## ")) {
          if (line.includes(targetChapter)) {
            startLineIdx = i;
            break;
          }
        }
      }
    }

    if (startLineIdx === -1) {
      alert(`Could not locate the chapter "${targetChapter}" content in markdown notes.`);
      return;
    }

    // Find the next line starting with a chapter heading
    for (let i = startLineIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if ((line.startsWith("# ") && !line.startsWith("# Subject:")) || line.startsWith("## Topic:") || line.startsWith("## ")) {
        endLineIdx = i;
        break;
      }
    }

    // Decouple before, chapter, and after segments
    const beforeLines = lines.slice(0, startLineIdx);
    const chapterLines = lines.slice(startLineIdx, endLineIdx);
    const afterLines = lines.slice(endLineIdx);

    const beforeText = beforeLines.join("\n") + (beforeLines.length > 0 ? "\n" : "");
    const chapterContent = chapterLines.join("\n");
    const afterText = (afterLines.length > 0 ? "\n" : "") + afterLines.join("\n");

    // --- Shielding Heading Boundaries Programmatically ---
    const chapterHeader = chapterLines[0];
    let hasSources = false;
    let sourcesLine = "";
    if (chapterLines.length > 1 && chapterLines[1].trim().startsWith("* **Sources**:")) {
      hasSources = true;
      sourcesLine = chapterLines[1];
    }

    const bodyLines = hasSources ? chapterLines.slice(2) : chapterLines.slice(1);
    const bodyText = bodyLines.join("\n").trim();

    // Prepare Sandbox Workspace Previews
    setOriginalTextBackup(chapterContent);
    setRestructurePreviewText("");
    setIsSandboxPreviewing(true);
    setRestructureContext({
      targetChapter,
      beforeText,
      afterText,
      chapterHeader,
      hasSources,
      sourcesLine
    });

    setIsCleaningChapter(true);
    let accumulatedText = "";

    try {
      const response = await fetch("/api/notes/restructure/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          text: bodyText,
          style: cleanStyle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Stream request failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Stream response body is not readable");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        setRestructurePreviewText(accumulatedText);
      }

    } catch (err: any) {
      console.error("Error cleaning chapter:", err);
      // Display error inside the preview workspace gracefully without corrupting notes
      setRestructurePreviewText((prev) => 
        prev + `\n\n⚠️ Restructuring stopped due to an error: ${err.message || err}. Please try again.`
      );
    } finally {
      setIsCleaningChapter(false);
    }
  };

  // Transactionally apply the completed restructured notes to live markdown
  const handleApplyChapterClean = async () => {
    if (!restructureContext) return;
    const { beforeText, afterText, chapterHeader, hasSources, sourcesLine } = restructureContext;

    // Save history backup for instant Undo capability
    setNotesHistoryBackup(markdown);

    // Deterministically re-assemble headers and body
    const headerPrefix = chapterHeader + "\n" + (hasSources ? sourcesLine + "\n" : "") + "\n";
    const finalizedChapterText = headerPrefix + restructurePreviewText.trim();
    const finalMarkdown = beforeText + finalizedChapterText + afterText;

    // Update active markdown notes state
    setMarkdown(finalMarkdown);
    setIsSandboxPreviewing(false);
    setRestructurePreviewText("");
    setOriginalTextBackup("");
    setRestructureContext(null);

    // Show visual undo notification toast
    setShowUndoToast(true);
    setTimeout(() => {
      setShowUndoToast(false);
    }, 10000);

    // Auto-save the notes with the fully updated markdown content
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage("");
    try {
      const saveRes = await fetch("/api/subject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          subject,
          markdown: finalMarkdown,
        }),
      });
      if (saveRes.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const errorData = await saveRes.json().catch(() => ({}));
        setErrorMessage(errorData.error || "Failed to save cleaned notes.");
      }
    } catch (saveErr: any) {
      console.error("Auto-save failed after restructuring:", saveErr);
      setErrorMessage(saveErr.message || "Error auto-saving cleaned notes.");
    } finally {
      setSaving(false);
    }
  };

  // Revert last restructure using backup history state
  const handleUndoRestructure = async () => {
    if (!notesHistoryBackup) return;
    const previousMarkdown = notesHistoryBackup;
    setMarkdown(previousMarkdown);
    setNotesHistoryBackup(null);
    setShowUndoToast(false);

    setSaving(true);
    try {
      await fetch("/api/subject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          subject,
          markdown: previousMarkdown,
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Undo save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  // Fix chapter links by using AI to analyze markdown and extract correct chapter structure
  const handleFixLinks = async () => {
    if (!markdown) return;
    setFixingLinks(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);
    try {
      const res = await fetch("/api/notes/fix-links", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAIHeaders() },
        body: JSON.stringify({ markdown }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.success && data.topics) {
        const fixedTopics = data.topics.map((t: any, i: number) => ({
          name: t.name || `Chapter ${i + 1}`,
          fullName: t.fullName || t.name || `Chapter ${i + 1}`,
          sources: t.sources || [],
          subsections: (t.subsections || []).map((s: any) => ({
            name: s.name || s.fullName || "",
            fullName: s.fullName || s.name || "",
          })),
        }));
        setTopics(fixedTopics);
      } else {
        console.error("Fix links failed:", data.error);
      }
    } catch (e) {
      console.error("Fix links error:", e);
    } finally {
      clearTimeout(timeoutId);
      setFixingLinks(false);
    }
  };

  // Rename a specific chapter header inside notes markdown state and database
  const handleRenameTopic = (oldName: string, oldFullName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) {
      setEditingTopicName(null);
      return;
    }

    const possibleHeaders = [
      `## Topic: ${oldFullName}`,
      `## Topic: ${oldName}`,
      `## ${oldFullName}`,
      `## ${oldName}`
    ];

    let foundHeader = "";
    let headerIdx = -1;

    for (const h of possibleHeaders) {
      const idx = markdown.indexOf(h);
      if (idx !== -1) {
        foundHeader = h;
        headerIdx = idx;
        break;
      }
    }

    if (headerIdx === -1) {
      alert("Could not locate this chapter's header in your notes markdown.");
      setEditingTopicName(null);
      return;
    }

    let newHeader = "";
    if (foundHeader.startsWith("## Topic:")) {
      newHeader = `## Topic: ${newName.trim()}`;
    } else {
      newHeader = `## ${newName.trim()}`;
    }

    const updatedMarkdown = 
      markdown.substring(0, headerIdx) + 
      newHeader + 
      markdown.substring(headerIdx + foundHeader.length);

    setMarkdown(updatedMarkdown);
    setEditingTopicName(null);

    // Auto-save restructured notes back to vector store/database
    setTimeout(async () => {
      setSaving(true);
      try {
        await fetch("/api/subject", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAIHeaders(),
          },
          body: JSON.stringify({
            subject,
            markdown: updatedMarkdown,
          }),
        });
      } catch (e) {
        console.error("Failed to auto-save after chapter rename:", e);
      } finally {
        setSaving(false);
      }
    }, 500);
  };

  // Escape key listener for Focus Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusMode]);



  return (
    <>
      {/* ── Normal Layout ── */}
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0b0f19]">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar />
          
          <main className="flex-1 overflow-hidden flex flex-col relative">
          
          <SubjectHeader
            subject={subject}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            showReaderPrefs={showReaderPrefs}
            onToggleReaderPrefs={() => setShowReaderPrefs(!showReaderPrefs)}
            onCloseReaderPrefs={() => setShowReaderPrefs(false)}
            activeFont={activeFont}
            onFontChange={setActiveFont}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            pageWidth={pageWidth}
            onPageWidthChange={setPageWidth}
            lineHeight={lineHeight}
            onLineHeightChange={setLineHeight}
            letterSpacing={letterSpacing}
            onLetterSpacingChange={setLetterSpacing}
            wordSpacing={wordSpacing}
            onWordSpacingChange={setWordSpacing}
            focusMode={focusMode}
            onFocusModeChange={setFocusMode}
            aiPanelCollapsed={aiPanelCollapsed}
            onAiPanelToggle={() => setAiPanelCollapsed(!aiPanelCollapsed)}
            saving={saving}
            onSave={handleSaveNotes}
            onExportOpen={() => setIsExportModalOpen(true)}
            voices={voices}
            selectedVoice={selectedVoice}
            onVoiceChange={handleVoiceChange}
            speechRate={speechRate}
            onRateChange={handleRateChange}
          />

          <NotificationBanners
            saveSuccess={saveSuccess}
            errorMessage={errorMessage}
            onDismissError={() => setErrorMessage("")}
          />

          {/* ── Main Workspace ── */}
          <div className="flex-1 flex overflow-hidden w-full relative">

            <TocSidebar
              tocCollapsed={tocCollapsed}
              onOpenCollapse={() => setTocCollapsed(false)}
              onToggleCollapse={() => setTocCollapsed(true)}
              topics={topics}
              sidebarTab={sidebarTab}
              onSidebarTabChange={setSidebarTab}
              highlights={highlights}
              editingTopicName={editingTopicName}
              editValue={editValue}
              onEditValueChange={setEditValue}
              onStartEditing={(name) => { setEditingTopicName(name); setEditValue(name); }}
              onStopEditing={() => setEditingTopicName(null)}
              onRename={handleRenameTopic}
              onDelete={handleDeleteTopic}
              onDeleteHighlight={handleDeleteHighlight}
              onScrollToTopic={handleScrollToTopic}
              onFixLinks={handleFixLinks}
              fixingLinks={fixingLinks}
              markdown={markdown}
              previewContainerRef={previewContainerRef}
            />



            {/* ── Content Area ── */}
            <div className="flex-1 bg-[#ebeaeb] dark:bg-[#080b14] p-4 overflow-hidden flex flex-col">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
                  <Loader2 className={`h-8 w-8 animate-spin ${processing ? "text-amber-500" : "text-indigo-500"}`} />
                  <span className="text-xs text-slate-400 dark:text-slate-500 text-center">
                    {processing ? "Processing your uploads — this may take a minute..." : "Loading notes..."}
                  </span>
                  {processing && (
                    <div className="w-full max-w-md space-y-3">
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${Math.max(taskProgress, 2)}%`,
                            background:
                              "linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)",
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          {taskNode
                            ? ({
                                save_raw_clean: "Cleaning text",
                                analyze_structure: "Analyzing structure",
                                semantic_split: "Splitting content",
                                generate_toc: "Building TOC",
                                semantic_tag: "Tagging topics",
                                assemble_chapters: "Assembling chapters",
                                format_chapters: "Formatting notes",
                                save_to_chroma: "Embedding into vector DB",
                                compile_wiki_pages: "Compiling wiki",
                              } as Record<string, string>)[taskNode] || taskNode
                            : "Preparing..."}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 font-bold">
                          {taskProgress}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex gap-4 overflow-hidden justify-center">

                  {/* Mindmap Panel */}
                  {activeTab === "mindmap" && (
                    <div className="flex-1 w-full h-full bg-slate-50 dark:bg-[#0b0f19] rounded-xl flex items-center justify-center relative overflow-hidden">
                      {loadingMindmap ? (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                          <span className="text-sm">Loading Neural Graph...</span>
                        </div>
                      ) : mindmapData ? (
                          <div className="w-full h-full bg-slate-900 rounded-xl overflow-hidden">
                            <GraphErrorBoundary>
                              <ReactFlowGraph
                                nodes={mindmapData.nodes.map((n: any) => ({
                                  id: n.id,
                                  label: n.label,
                                  subject: subject
                                }))}
                                edges={mindmapData.links.map((e: any) => ({
                                  id: `${e.source.id || e.source}-${e.target.id || e.target}`,
                                  source: e.source.id || e.source,
                                  target: e.target.id || e.target,
                                  label: e.label
                                }))}
                              />
                            </GraphErrorBoundary>
                          </div>
                      ) : (
                        <div className="text-center text-slate-400 p-8 max-w-md">
                          <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">No Mindmap Available</h3>
                          <p className="text-sm mb-6">We don&apos;t have a mindmap graph for this subject yet. You can generate one on-demand from the compiled Wiki pages.</p>
                          <button
                            onClick={handleGenerateMindmap}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                          >
                            Generate Mindmap from Wiki
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Editor Panel (split mode uses TiptapEditor) ── */}
                  {activeTab === "split" && (
                    <div className="flex-1 flex flex-col bg-white dark:bg-[#111726] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full max-w-4xl">
                      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Edit3 className="h-3 w-3 text-indigo-500" /> Editor
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4">
                        <TiptapEditor
                          initialMarkdown={markdown}
                          onChange={setMarkdown}
                          pageWidth={pageWidth}
                          fontFamily={getFontFamily(activeFont)}
                          lineHeight={lineHeight}
                          letterSpacing={letterSpacing}
                          wordSpacing={wordSpacing}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Preview Panel ── */}
                  {(activeTab === "preview" || activeTab === "split") && (
                    <div className={`h-full ${activeTab === 'preview' ? 'w-full' : 'flex-1'} flex flex-col overflow-hidden relative`}>
                      {/* Breadcrumbs Active Chapter Filter (Static, space-saving) */}
                      {markdown.trim() && topics.length > 0 && (
                        <div className="w-full px-8 py-3 bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-200/50 dark:border-slate-800/30 flex items-center justify-between text-xs font-medium text-slate-500 shrink-0 select-none">
                          <div className="flex items-center gap-1.5">
                            <span>Library</span>
                            <span className="text-slate-300">/</span>
                            <span className="font-bold text-slate-700 dark:text-slate-350">{formatDisplayName(subject)}</span>
                            <span className="text-slate-300">/</span>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold">
                              {activeChapterFilter === "All" ? "📚 All Chapters" : `📖 ${activeChapterFilter}`}
                            </span>
                          </div>
                          {activeChapterFilter !== "All" && (
                            <button onClick={() => { setActiveChapterFilter("All"); setSelectedChapterName(topics[0]?.name || ""); }} className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Scrollable Document Paper */}
                      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 w-full flex flex-col items-center">
                        <div className="w-full flex-1">
                          <div id="print-notes-area-wrapper" className="w-full">
                            <div id="print-notes-area">
                              <PreviewPanel
                                previewContainerRef={previewContainerRef}
                                handleTextSelection={handleTextSelection}
                                pageWidth={pageWidth}
                                isDark={isDark}
                                activeFont={activeFont}
                                getFontFamily={getFontFamily}
                                markdown={markdown}
                                cleanAiMarkdownArtifacts={cleanAiMarkdownArtifacts}
                                topics={topics}
                                subject={subject}
                                activeChapterFilter={activeChapterFilter}
                                parsedTOC={parsedTOC}
                                formatDisplayName={formatDisplayName}
                                highlights={highlights}
                                fontSize={fontSize}
                                lineHeight={lineHeight}
                                letterSpacing={letterSpacing}
                                wordSpacing={wordSpacing}
                                currentBlockIndex={currentBlockIndex ?? 0}
                                speakBlock={speakBlock}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Floating Sleeping Glassmorphic Overlay */}
                      {isCleaningChapter && (
                        <div className="absolute inset-0 bg-[#ebeaeb]/60 dark:bg-[#080b14]/75 backdrop-blur-[3px] z-25 flex flex-col items-center justify-center select-none cursor-wait animate-fade-in">
                          {/* Breathing Sleep Light */}
                          <div className="relative flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 blur-md opacity-70 animate-pulse" style={{ animationDuration: '3s' }} />
                            <div className="absolute w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/50 flex items-center justify-center animate-ping" style={{ animationDuration: '2s' }} />
                          </div>
                          <span className="text-[10px] font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400 mt-5 uppercase animate-pulse">
                            AI is refining chapter...
                          </span>
                        </div>
                      )}
                    </div>
                  )}
 
                  {/* ── Visual Editor Panel ── */}
                  {activeTab === "visual" && (
                    <div className="h-full w-full flex flex-col overflow-hidden relative">
                      {/* Breadcrumbs Active Chapter Filter (Static, space-saving) */}
                      {markdown.trim() && topics.length > 0 && (
                        <div className="w-full px-8 py-3 bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-200/50 dark:border-slate-800/30 flex items-center justify-between text-xs font-medium text-slate-500 shrink-0 select-none">
                          <div className="flex items-center gap-1.5">
                            <span>Library</span>
                            <span className="text-slate-300">/</span>
                            <span className="font-bold text-slate-700 dark:text-slate-350">{formatDisplayName(subject)}</span>
                            <span className="text-slate-300">/</span>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold">
                              {activeChapterFilter === "All" ? "📚 All Chapters" : `📖 ${activeChapterFilter}`}
                            </span>
                          </div>
                          {activeChapterFilter !== "All" && (
                            <button onClick={() => { setActiveChapterFilter("All"); setSelectedChapterName(topics[0]?.name || ""); }} className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Scrollable Visual Editor content */}
                      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 w-full flex flex-col items-center">
                        <div className="w-full flex-1">
                          <TiptapEditor
                            initialMarkdown={markdown}
                            onChange={setMarkdown}
                            pageWidth={pageWidth}
                            fontFamily={getFontFamily(activeFont)}
                            lineHeight={lineHeight}
                            letterSpacing={letterSpacing}
                            wordSpacing={wordSpacing}
                          />
                        </div>
                      </div>

                      {/* Floating Sleeping Glassmorphic Overlay */}
                      {isCleaningChapter && (
                        <div className="absolute inset-0 bg-[#ebeaeb]/60 dark:bg-[#080b14]/75 backdrop-blur-[3px] z-25 flex flex-col items-center justify-center select-none cursor-wait animate-fade-in">
                          {/* Breathing Sleep Light */}
                          <div className="relative flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 blur-md opacity-70 animate-pulse" style={{ animationDuration: '3s' }} />
                            <div className="absolute w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/50 flex items-center justify-center animate-ping" style={{ animationDuration: '2s' }} />
                          </div>
                          <span className="text-[10px] font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400 mt-5 uppercase animate-pulse">
                            AI is refining chapter...
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Restructure Side Drawer removed in favor of focused full-screen overlay modal */}

                </div>
              )}
            </div>
            
            <AiAssistantPanel
              collapsed={aiPanelCollapsed}
              onClose={() => setAiPanelCollapsed(true)}
              selectedChapterName={selectedChapterName}
              onSelectedChapterChange={setSelectedChapterName}
              onActiveChapterFilterChange={setActiveChapterFilter}
              cleanStyle={cleanStyle}
              onCleanStyleChange={setCleanStyle}
              isCleaningChapter={isCleaningChapter}
              onCleanChapter={handleCleanChapter}
              topics={topics}
              onGenerateMindmap={handleGenerateMindmap}
            />
          </div>
          </main>
        </div>
      </div>

      <SelectionHud
        visible={!!(popoverPosition && selectedText && !isRestructuring)}
        selectedText={selectedText}
        onHighlight={handleSaveHighlight}
        onAnnotate={() => setIsAnnotating(true)}
        onExplain={handleSocraticQuery}
        onRestructure={() => { setIsRestructuring(true); setRestructuredText(""); }}
        onClear={() => { setSelectedText(""); setPopoverPosition(null); if (typeof window !== "undefined") { window.getSelection()?.removeAllRanges(); } }}
      />

      <AnnotationPopup
        isOpen={isAnnotating}
        position={popoverPosition}
        text={annotationText}
        onChange={setAnnotationText}
        onSave={(t: string) => handleSaveHighlight("yellow", t)}
        onCancel={() => setIsAnnotating(false)}
      />

      <SocraticPopup
        isOpen={!!(loadingSocratic || socraticAnswer)}
        isLoading={loadingSocratic}
        answer={socraticAnswer}
        questionText={socraticText}
        position={popoverPosition}
        onClose={() => { setSocraticAnswer(""); setLoadingSocratic(false); }}
      />

      <FocusMode
        open={focusMode}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        onExit={() => setFocusMode(false)}
      >
        <PreviewPanel
          previewContainerRef={previewContainerRef}
          handleTextSelection={handleTextSelection}
          pageWidth={pageWidth}
          isDark={isDark}
          activeFont={activeFont}
          getFontFamily={getFontFamily}
          markdown={markdown}
          cleanAiMarkdownArtifacts={cleanAiMarkdownArtifacts}
          topics={topics}
          subject={subject}
          activeChapterFilter={activeChapterFilter}
          parsedTOC={parsedTOC}
          formatDisplayName={formatDisplayName}
          highlights={highlights}
          fontSize={fontSize}
          lineHeight={lineHeight}
          letterSpacing={letterSpacing}
          wordSpacing={wordSpacing}
          currentBlockIndex={currentBlockIndex ?? 0}
          speakBlock={speakBlock}
        />
      </FocusMode>



      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onDownloadMarkdown={handleDownloadMarkdown}
        onDownloadDocx={handleDownloadDocx}
        onPrintPdf={handlePrintPdf}
      />

      <TTSPlayerPill
        isPlaying={isPlaying}
        isPaused={isPaused}
        currentBlockIndex={currentBlockIndex}
        onPause={handlePauseTTS}
        onPlay={handlePlayTTS}
        onStop={handleStopTTS}
      />

      <RestructureModal
        isOpen={isRestructuring}
        selectedText={selectedText}
        restructureStyle={restructureStyle}
        restructureCustom={restructureCustom}
        generatingRestructure={generatingRestructure}
        restructuredText={restructuredText}
        onStyleChange={setRestructureStyle}
        onCustomChange={setRestructureCustom}
        onExecute={handleRestructureQuery}
        onApply={handleApplyRestructure}
        onClose={() => { setIsRestructuring(false); setRestructuredText(""); }}
        onDiscard={() => { setRestructuredText(""); setIsRestructuring(false); }}
      />

      <SandboxCompareModal
        isOpen={isSandboxPreviewing}
        isCleaningChapter={isCleaningChapter}
        subject={subject}
        restructureContext={restructureContext}
        originalTextBackup={originalTextBackup}
        restructurePreviewText={restructurePreviewText}
        onClose={() => { setIsSandboxPreviewing(false); setRestructurePreviewText(""); setOriginalTextBackup(""); setRestructureContext(null); }}
        onApply={handleApplyChapterClean}
        onDiscard={() => { setIsSandboxPreviewing(false); setRestructurePreviewText(""); setOriginalTextBackup(""); setRestructureContext(null); }}
      />

      <UndoToast
        visible={showUndoToast}
        onUndo={handleUndoRestructure}
      />
    </>
  );
}
