"use client";

import React, { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import {
  BookOpen,
  Edit3,
  Save,
  ChevronRight,
  ChevronDown,
  Plus,
  Download,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
  Eye,
  Columns,
  BookMarked,
  List,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  X,
  Network,
  Search,
  Trash2,
  Volume2,
  Play,
  Pause,
  Square,
  FileText,
  Printer,
  Sparkles
} from "lucide-react";
import { getAIHeaders, HARDCODED_SUBJECTS } from "@/lib/settings";
import dynamic from "next/dynamic";
import CustomDropdown, { DropdownOption } from "@/components/CustomDropdown";

import ReactFlowGraph from "@/components/ReactFlowGraph";

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

interface SubSectionNode {
  name: string;
  fullName: string;
}

interface TopicNode {
  name: string;
  fullName: string;
  sources: string[];
  subsections: SubSectionNode[];
}

export interface VisualBlock {
  id: string;
  type: "h1" | "h2" | "h3" | "p" | "ul" | "ol" | "quote" | "code" | "sources" | "hr";
  content: string;
}

const inlineMarkdownToHtml = (text: string): string => {
  let html = text;
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");
  html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");
  html = html.replace(/==(.*?)==/g, '<mark class="bg-amber-100 dark:bg-amber-500/25 px-1 rounded">$1</mark>');
  return html;
};

const inlineHtmlToMarkdown = (html: string): string => {
  let md = html;
  md = md.replace(/<del>(.*?)<\/del>/g, "~~$1~~");
  md = md.replace(/<s>(.*?)<\/s>/g, "~~$1~~");
  md = md.replace(/<mark[^>]*>(.*?)<\/mark>/g, "==$1==");
  md = md.replace(/<span[^>]*class="[^"]*bg-amber-100[^"]*"[^>]*>(.*?)<\/span>/g, "==$1==");
  md = md.replace(/<strong>(.*?)<\/strong>/g, "**$1**");
  md = md.replace(/<b>(.*?)<\/b>/g, "**$1**");
  md = md.replace(/<em>(.*?)<\/em>/g, "*$1*");
  md = md.replace(/<i>(.*?)<\/i>/g, "*$1*");
  md = md.replace(/<u>(.*?)<\/u>/g, "<u>$1</u>");
  md = md.replace(/<[^>]+>/g, "");
  md = md.replace(/&nbsp;/g, " ")
         .replace(/&amp;/g, "&")
         .replace(/&lt;/g, "<")
         .replace(/&gt;/g, ">");
  return md;
};

const parseMarkdownToBlocks = (md: string): VisualBlock[] => {
  if (!md.trim()) return [];
  const normalized = md.replace(/\n\s*---\s*\n/g, "\n---\n");
  const sections = normalized.split("\n\n");
  return sections.map((section, idx) => {
    const trimmed = section.trim();
    const id = `block-${idx}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (trimmed === "---") {
      return { id, type: "hr", content: "" };
    }
    if (trimmed.startsWith("# Subject:")) {
      return { id, type: "h1", content: inlineMarkdownToHtml(trimmed.replace("# Subject:", "").trim()) };
    }
    if (trimmed.startsWith("## Topic:")) {
      return { id, type: "h2", content: inlineMarkdownToHtml(trimmed.replace("## Topic:", "").trim()) };
    }
    if (trimmed.startsWith("## ")) {
      return { id, type: "h2", content: inlineMarkdownToHtml(trimmed.replace("## ", "").trim()) };
    }
    if (trimmed.startsWith("### ")) {
      return { id, type: "h3", content: inlineMarkdownToHtml(trimmed.replace("### ", "").trim()) };
    }
    if (trimmed.startsWith("* **Sources**:")) {
      return { id, type: "sources", content: inlineMarkdownToHtml(trimmed.replace(/\* \*\*Sources\*\*:\s*/, "").trim()) };
    }
    if (trimmed.startsWith("> ")) {
      const content = trimmed.split("\n").map(l => l.replace(/^>\s*/, "")).join(" ");
      return { id, type: "quote", content: inlineMarkdownToHtml(content) };
    }
    if (trimmed.startsWith("```")) {
      const code = trimmed.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
      return { id, type: "code", content: code };
    }
    
    const lines = trimmed.split("\n");
    const isBulletList = lines.every(l => l.trim().startsWith("- ") || l.trim().startsWith("* ") || l.trim().startsWith("• "));
    if (isBulletList) {
      const listContent = lines.map(l => {
        const clean = l.replace(/^[-*•]\s+/, "").trim();
        return `<li>${inlineMarkdownToHtml(clean)}</li>`;
      }).join("");
      return { id, type: "ul", content: listContent };
    }

    const isNumberedList = lines.every(l => /^\d+\.\s+/.test(l.trim()));
    if (isNumberedList) {
      const listContent = lines.map(l => {
        const clean = l.replace(/^\d+\.\s+/, "").trim();
        return `<li>${inlineMarkdownToHtml(clean)}</li>`;
      }).join("");
      return { id, type: "ol", content: listContent };
    }

    return { id, type: "p", content: inlineMarkdownToHtml(trimmed) };
  });
};

const serializeBlocksToMarkdown = (blocks: VisualBlock[]): string => {
  return blocks.map(block => {
    switch (block.type) {
      case "hr":
        return "---";
      case "h1":
        return `# Subject: ${inlineHtmlToMarkdown(block.content)}`;
      case "h2":
        return `## Topic: ${inlineHtmlToMarkdown(block.content)}`;
      case "h3":
        return `### ${inlineHtmlToMarkdown(block.content)}`;
      case "quote":
        return `> ${inlineHtmlToMarkdown(block.content)}`;
      case "code":
        return `\`\`\`\n${block.content.replace(/<[^>]+>/g, "")}\n\`\`\``;
      case "sources":
        return `* **Sources**: ${inlineHtmlToMarkdown(block.content)}`;
      case "ul": {
        const listItems: string[] = [];
        const matches = block.content.match(/<li[^>]*>(.*?)<\/li>/g);
        if (matches) {
          matches.forEach(item => {
            const inner = item.replace(/<li[^>]*>/, "").replace(/<\/li>/, "");
            listItems.push(`- ${inlineHtmlToMarkdown(inner)}`);
          });
        } else {
          listItems.push(`- ${inlineHtmlToMarkdown(block.content)}`);
        }
        return listItems.join("\n");
      }
      case "ol": {
        const listItems: string[] = [];
        const matches = block.content.match(/<li[^>]*>(.*?)<\/li>/g);
        if (matches) {
          matches.forEach((item, idx) => {
            const inner = item.replace(/<li[^>]*>/, "").replace(/<\/li>/, "");
            listItems.push(`${idx + 1}. ${inlineHtmlToMarkdown(inner)}`);
          });
        } else {
          listItems.push(`1. ${inlineHtmlToMarkdown(block.content)}`);
        }
        return listItems.join("\n");
      }
      case "p":
      default:
        return inlineHtmlToMarkdown(block.content);
    }
  }).join("\n\n");
};

const VisualBlockItem = ({
  block,
  onChange,
  onFocus,
  onKeyDown,
}: {
  block: VisualBlock;
  onChange: (id: string, content: string) => void;
  onFocus: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
}) => {
  const ref = useRef<any>(null);
  
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== block.content) {
      ref.current.innerHTML = block.content;
    }
  }, [block.content]);

  const handleInput = () => {
    if (ref.current) {
      onChange(block.id, ref.current.innerHTML);
    }
  };

  const Tag = block.type === "quote" 
    ? "blockquote" 
    : block.type === "hr" 
      ? "hr" 
      : block.type === "sources" 
        ? "div" 
        : block.type;
  
  if (Tag === "hr") {
    return <hr className="my-8 border-t-2 border-dashed border-slate-200 dark:border-slate-800 w-full" />;
  }

  const getBlockClasses = () => {
    const base = "focus:outline-none transition-all duration-200 my-2 px-2 py-1 rounded-lg border border-transparent w-full text-left";
    switch (block.type) {
      case "h1":
        return `${base} text-3xl font-extrabold text-slate-900 dark:text-white mt-8 mb-4 border-b pb-2`;
      case "h2":
        return `${base} text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-6 mb-3 border-l-4 border-indigo-500 pl-3`;
      case "h3":
        return `${base} text-xl font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2 pl-1`;
      case "quote":
        return `${base} border-l-4 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 pl-4 py-2 text-slate-600 dark:text-slate-400 italic`;
      case "code":
        return `${base} font-mono text-xs bg-slate-900 text-emerald-400 p-4 rounded-xl shadow-inner border border-slate-800 dark:border-slate-800/80 my-4 whitespace-pre overflow-x-auto`;
      case "sources":
        return `${base} text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800/60 p-2 rounded-xl my-4`;
      case "ul":
        return `${base} list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300`;
      case "ol":
        return `${base} list-decimal pl-5 space-y-1 text-slate-700 dark:text-slate-300`;
      default:
        return `${base} text-slate-700 dark:text-slate-300 leading-relaxed`;
    }
  };

  return (
    <Tag
      ref={ref}
      contentEditable={true}
      suppressContentEditableWarning={true}
      onInput={handleInput}
      onFocus={() => onFocus(block.id)}
      onKeyDown={(e: React.KeyboardEvent) => onKeyDown(e, block.id)}
      className={getBlockClasses()}
      data-placeholder={block.type === "p" ? "Type paragraph..." : "Heading..."}
      data-block-id={block.id}
    />
  );
};

export default function SubjectBinder() {
  const [subject, setSubject] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [sources, setSources] = useState<string[]>([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingMindmap, setLoadingMindmap] = useState(false);

  // Layout states
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "edit" | "split" | "visual" | "mindmap">("preview");

  // --- Visual Inline Editor States ---
  const [visualBlocks, setVisualBlocks] = useState<VisualBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [menuType, setMenuType] = useState<"add" | "actions" | null>(null);
  const [activeMenuBlockId, setActiveMenuBlockId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectionMenuOpen, setSelectionMenuOpen] = useState(false);
  const [selectionMenuPos, setSelectionMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);

  // --- Sidebar TOC Renaming States ---
  const [editingTopicName, setEditingTopicName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Reading enhancements
  const [fontSize, setFontSize] = useState(16);
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

  // Socratic Explainer State
  const [socraticText, setSocraticText] = useState("");
  const [socraticAnswer, setSocraticAnswer] = useState("");
  const [loadingSocratic, setLoadingSocratic] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // --- Text-to-Speech (TTS) & Export States & Hooks ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentBlockIndex, setCurrentBlockIndex] = useState<number | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechPitch, setSpeechPitch] = useState(1.0);

  const isPlayingRef = useRef(false);
  const currentBlockIndexRef = useRef<number | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const selectedVoiceRef = useRef("");
  const speechRateRef = useRef(1.0);
  const speechPitchRef = useRef(1.0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // --- Typography & Width States & Google Fonts Loader ---
  const [activeFont, setActiveFont] = useState("garamond");
  const [pageWidth, setPageWidth] = useState(820);

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

  // Synchronize refs to prevent stale closures in SpeechSynthesis callbacks
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentBlockIndexRef.current = currentBlockIndex; }, [currentBlockIndex]);
  useEffect(() => { voicesRef.current = voices; }, [voices]);
  useEffect(() => { selectedVoiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { speechRateRef.current = speechRate; }, [speechRate]);
  useEffect(() => { speechPitchRef.current = speechPitch; }, [speechPitch]);

  // Load voices on mount
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      
      // Filter English and Hindi first
      const primaryVoices = list.filter(v => v.lang.startsWith("en") || v.lang.startsWith("hi"));
      const otherVoices = list.filter(v => !v.lang.startsWith("en") && !v.lang.startsWith("hi"));
      
      // Helper to evaluate voice premium/human-like quality
      const isPremiumVoice = (v: SpeechSynthesisVoice) => {
        const name = v.name.toLowerCase();
        return name.includes("enhanced") || 
               name.includes("google") || 
               name.includes("siri") || 
               name.includes("premium") || 
               name.includes("natural") || 
               name.includes("samantha") || 
               name.includes("daniel");
      };

      // Sort primary voices: premium ones first
      const sortedPrimary = [...primaryVoices].sort((a, b) => {
        const aPrem = isPremiumVoice(a);
        const bPrem = isPremiumVoice(b);
        if (aPrem && !bPrem) return -1;
        if (!aPrem && bPrem) return 1;
        return 0;
      });

      const sorted = [...sortedPrimary, ...otherVoices];

      // Ensure unique voice URIs to prevent duplicate keys in dropdown
      const uniqueVoices: SpeechSynthesisVoice[] = [];
      const seenURIs = new Set<string>();
      for (const v of sorted) {
        if (!seenURIs.has(v.voiceURI)) {
          seenURIs.add(v.voiceURI);
          uniqueVoices.push(v);
        }
      }

      setVoices(uniqueVoices);

      if (uniqueVoices.length > 0) {
        // Default to the first sorted primary voice (which will be premium if available!)
        // Prefer "Google US English", "Samantha", or Siri, otherwise take the first premium one
        const preferred = sortedPrimary.find(v =>
          v.name.includes("Google US English") ||
          v.name.includes("Samantha") ||
          v.name.includes("Siri") ||
          v.name.includes("Daniel")
        ) || sortedPrimary.find(isPremiumVoice) || sortedPrimary[0];
        
        setSelectedVoice(preferred ? preferred.voiceURI : uniqueVoices[0].voiceURI);
      }
    };

    loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const cleanMarkdownForSpeech = (text: string): string => {
    return text
      .replace(/#+ Subject:/gi, "")
      .replace(/#+/g, "")
      .replace(/\*\*|__/g, "")
      .replace(/\*|_/g, "")
      .replace(/[-*•]\s+/g, "")
      .replace(/\|\s*[-:]+\s*\|/g, "")
      .replace(/\|/g, " ")
      .replace(/>\s?/g, "")
      .replace(/---\n/g, "")
      .trim();
  };

  const speakBlock = (index: number) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const blocks = markdown.replace(/\n\s*---\s*\n/g, "\n---\n").split("\n\n");

    if (index >= blocks.length || index < 0) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentBlockIndex(null);
      return;
    }

    const rawBlockText = blocks[index].trim();
    const speakableText = cleanMarkdownForSpeech(rawBlockText);

    if (!speakableText.trim()) {
      // Skip empty block
      speakBlock(index + 1);
      return;
    }

    setCurrentBlockIndex(index);
    setIsPlaying(true);
    setIsPaused(false);

    window.speechSynthesis.cancel();

    setTimeout(() => {
      if (!isPlayingRef.current) return;

      const utterance = new SpeechSynthesisUtterance(speakableText);
      const activeVoice = voicesRef.current.find(v => v.voiceURI === selectedVoiceRef.current);
      if (activeVoice) {
        utterance.voice = activeVoice;
      }

      utterance.rate = speechRateRef.current;
      utterance.pitch = speechPitchRef.current;

      utterance.onend = () => {
        if (isPlayingRef.current && !window.speechSynthesis.paused) {
          speakBlock(index + 1);
        }
      };

      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis utterance error:", e);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  const handlePlayTTS = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    const startIndex = currentBlockIndex !== null ? currentBlockIndex : 0;
    isPlayingRef.current = true;
    speakBlock(startIndex);
  };

  const handlePauseTTS = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStopTTS = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    isPlayingRef.current = false;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentBlockIndex(null);
  };

  const handleVoiceChange = (voiceURI: string) => {
    setSelectedVoice(voiceURI);
    if (isPlayingRef.current && currentBlockIndex !== null) {
      setTimeout(() => {
        speakBlock(currentBlockIndexRef.current || 0);
      }, 100);
    }
  };

  const handleRateChange = (newRate: number) => {
    setSpeechRate(newRate);
    if (isPlayingRef.current && currentBlockIndex !== null) {
      setTimeout(() => {
        speakBlock(currentBlockIndexRef.current || 0);
      }, 100);
    }
  };

  const handlePitchChange = (newPitch: number) => {
    setSpeechPitch(newPitch);
    if (isPlayingRef.current && currentBlockIndex !== null) {
      setTimeout(() => {
        speakBlock(currentBlockIndexRef.current || 0);
      }, 100);
    }
  };

  // --- Export Utilities ---
  const cleanInlineMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>");
  };

  const convertMarkdownToHtml = (md: string): string => {
    const blocks = md.replace(/\n\s*---\s*\n/g, "\n---\n").split("\n\n");
    let html = "";

    blocks.forEach((block) => {
      const trimmed = block.trim();
      if (!trimmed) return;

      if (trimmed === "---") {
        html += "<hr/>";
        return;
      }

      if (trimmed.startsWith("|")) {
        const rows = trimmed.split("\n").map(r => r.trim()).filter(r => r.startsWith("|"));
        if (rows.length >= 2) {
          html += "<table>";
          const parsedRows = rows.map(r => r.split("|").slice(1, -1).map(c => c.trim()));
          const headers = parsedRows[0];
          const hasSeparator = rows[1].includes("-");
          const bodyRows = hasSeparator ? parsedRows.slice(2) : parsedRows.slice(1);

          html += "<thead><tr>";
          headers.forEach(h => {
            html += `<th>${cleanInlineMarkdown(h)}</th>`;
          });
          html += "</tr></thead><tbody>";
          bodyRows.forEach(row => {
            html += "<tr>";
            row.forEach(cell => {
              html += `<td>${cleanInlineMarkdown(cell)}</td>`;
            });
            html += "</tr>";
          });
          html += "</tbody></table>";
          return;
        }
      }

      const lines = trimmed.split("\n");
      const isList = lines.every(l => l.trim().startsWith("- ") || l.trim().startsWith("* ") || l.trim().startsWith("• "));
      if (isList) {
        html += "<ul>";
        lines.forEach(l => {
          const cleanLine = l.replace(/^[-*•]\s+/, "").trim();
          html += `<li>${cleanInlineMarkdown(cleanLine)}</li>`;
        });
        html += "</ul>";
        return;
      }

      const firstLine = lines[0].trim();
      if (firstLine.startsWith("# Subject:")) {
        const name = firstLine.replace("# Subject:", "").trim();
        html += `<h1>Subject: ${cleanInlineMarkdown(name)}</h1>`;
        return;
      }

      if (firstLine.startsWith("## ")) {
        const heading = firstLine.replace("## ", "").trim();
        const display = heading.startsWith("Topic:") ? heading.replace("Topic:", "").trim() : heading;
        html += `<h2>${cleanInlineMarkdown(display)}</h2>`;
        return;
      }

      if (firstLine.startsWith("### ")) {
        const heading = firstLine.replace("### ", "").trim();
        html += `<h3>${cleanInlineMarkdown(heading)}</h3>`;
        return;
      }

      if (firstLine.startsWith("* **Sources**:")) {
        const match = firstLine.match(/\* \*\*Sources\*\*:\s*(.*)/);
        const srcText = match ? match[1].trim() : "";
        html += `<div class="sources">Source Material: ${cleanInlineMarkdown(srcText || "Manual Entry")}</div>`;
        return;
      }

      if (firstLine.startsWith("> ")) {
        const content = lines.map(l => l.replace(/^>\s?/, "").trim()).join("\n");
        html += `<blockquote>${cleanInlineMarkdown(content)}</blockquote>`;
        return;
      }

      html += `<p>${cleanInlineMarkdown(trimmed)}</p>`;
    });

    return html;
  };

  const handleDownloadDocx = () => {
    const title = subject || "Subject Notes";
    const cssStyles = `
      body {
        font-family: 'Georgia', serif;
        line-height: 1.6;
        color: #333333;
        margin: 40px;
      }
      h1 {
        font-size: 28px;
        color: #111111;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 10px;
        margin-bottom: 20px;
      }
      h2 {
        font-size: 20px;
        color: #4f46e5;
        border-left: 4px solid #4f46e5;
        padding-left: 10px;
        margin-top: 30px;
        margin-bottom: 15px;
      }
      h3 {
        font-size: 16px;
        color: #1a1a1a;
        margin-top: 20px;
        margin-bottom: 10px;
      }
      p {
        font-size: 12px;
        text-align: justify;
        margin-bottom: 15px;
      }
      ul, ol {
        margin-bottom: 15px;
        padding-left: 20px;
      }
      li {
        font-size: 12px;
        margin-bottom: 5px;
      }
      blockquote {
        font-style: italic;
        background-color: #fffbeb;
        border-left: 4px solid #f59e0b;
        padding: 10px 15px;
        margin: 20px 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      th, td {
        border: 1px solid #cccccc;
        padding: 8px 10px;
        font-size: 11px;
      }
      th {
        background-color: #f3f4f6;
        font-weight: bold;
      }
      .sources {
        font-size: 10px;
        color: #666666;
        font-style: italic;
        margin-bottom: 20px;
      }
    `;

    const htmlBody = convertMarkdownToHtml(markdown);

    const docxContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>\${title}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>90</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          \${cssStyles}
        </style>
      </head>
      <body>
        <h1>\${title} Notes</h1>
        \${htmlBody}
      </body>
      </html>
    `;

    const blob = new Blob([docxContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Subject_\${subject.replace(/\\s+/g, "_")}_Notes.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFontFamily = (f: string) => {
    switch (f) {
      case "garamond": return '"EB Garamond", Georgia, serif';
      case "caveat": return '"Caveat", cursive';
      case "architect": return '"Architects Daughter", cursive';
      case "cinzel": return '"Cinzel", serif';
      case "georgia": return 'Georgia, serif';
      case "sans": return 'system-ui, -apple-system, sans-serif';
      default: return 'Georgia, serif';
    }
  };

  // --- Visual Inline Editor Logic ---
  
  // Sync tab updates
  useEffect(() => {
    if (activeTab === "visual") {
      setVisualBlocks(parseMarkdownToBlocks(markdown));
    }
  }, [activeTab]);

  // Click outside menus to close them
  useEffect(() => {
    const handleGlobalClick = () => {
      setMenuType(null);
      setActiveMenuBlockId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // Selection change listener for floating formatting bubble
  useEffect(() => {
    const handleSelectionChange = () => {
      if (activeTab !== "visual") return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelectionMenuOpen(false);
        setSelectionMenuPos(null);
        setSelectionRange(null);
        return;
      }
      
      let node = sel.anchorNode;
      let inEditor = false;
      while (node) {
        if (node instanceof HTMLElement && node.dataset.visualEditorCanvas) {
          inEditor = true;
          break;
        }
        node = node.parentNode;
      }
      
      if (!inEditor) {
        setSelectionMenuOpen(false);
        setSelectionMenuPos(null);
        setSelectionRange(null);
        return;
      }

      const range = sel.getRangeAt(0);
      setSelectionRange(range);
      
      const rect = range.getBoundingClientRect();
      setSelectionMenuOpen(true);
      setSelectionMenuPos({
        top: rect.top + window.scrollY - 52, // Place bubble above text selection
        left: rect.left + window.scrollX + rect.width / 2
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [activeTab]);

  const updateBlockContent = (id: string, newContent: string) => {
    setVisualBlocks(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, content: newContent } : b);
      const newMarkdown = serializeBlocksToMarkdown(updated);
      setMarkdown(newMarkdown);
      return updated;
    });
  };

  const handleAddBlockClick = (e: React.MouseEvent<HTMLButtonElement>, blockId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveMenuBlockId(blockId);
    setMenuType("add");
    setMenuPos({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX
    });
  };

  const handleBlockActionsClick = (e: React.MouseEvent<HTMLButtonElement>, blockId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveMenuBlockId(blockId);
    setMenuType("actions");
    setMenuPos({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX
    });
  };

  const addBlock = (type: VisualBlock["type"], afterId: string) => {
    const newId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newBlock: VisualBlock = {
      id: newId,
      type,
      content: type === "ul" || type === "ol" ? "<li>List item</li>" : ""
    };
    
    setVisualBlocks(prev => {
      const idx = prev.findIndex(b => b.id === afterId);
      const next = [...prev];
      if (idx === -1) {
        next.push(newBlock);
      } else {
        next.splice(idx + 1, 0, newBlock);
      }
      
      const newMarkdown = serializeBlocksToMarkdown(next);
      setMarkdown(newMarkdown);
      
      // Auto focus the newly created block
      setTimeout(() => {
        const el = document.querySelector(`[data-block-id="${newId}"]`) as HTMLElement;
        if (el) {
          el.focus();
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }, 80);

      return next;
    });
    
    setMenuType(null);
    setActiveMenuBlockId(null);
  };

  const convertBlock = (type: VisualBlock["type"], blockId: string) => {
    setVisualBlocks(prev => {
      const updated = prev.map(b => {
        if (b.id !== blockId) return b;
        let content = b.content;
        if ((type === "ul" || type === "ol") && !content.includes("<li>")) {
          content = `<li>${content}</li>`;
        } else if (type !== "ul" && type !== "ol" && content.includes("<li>")) {
          content = content.replace(/<\/?li>/g, "");
        }
        return { ...b, type, content };
      });
      const newMarkdown = serializeBlocksToMarkdown(updated);
      setMarkdown(newMarkdown);
      return updated;
    });
    
    setMenuType(null);
    setActiveMenuBlockId(null);
  };

  const deleteBlock = (blockId: string) => {
    setVisualBlocks(prev => {
      if (prev.length <= 1) return prev;
      const updated = prev.filter(b => b.id !== blockId);
      const newMarkdown = serializeBlocksToMarkdown(updated);
      setMarkdown(newMarkdown);
      return updated;
    });
    
    setMenuType(null);
    setActiveMenuBlockId(null);
  };

  const handleBlockKeyDown = (e: React.KeyboardEvent, blockId: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const activeBlock = visualBlocks.find(b => b.id === blockId);
      if (activeBlock && (activeBlock.type === "ul" || activeBlock.type === "ol")) {
        return; // standard browser contenteditable handler
      }
      e.preventDefault();
      addBlock("p", blockId);
    } else if (e.key === "Backspace") {
      const activeBlock = visualBlocks.find(b => b.id === blockId);
      if (activeBlock && (!activeBlock.content || activeBlock.content === "<br>" || activeBlock.content === "<li></li>")) {
        e.preventDefault();
        
        const idx = visualBlocks.findIndex(b => b.id === blockId);
        if (idx > 0) {
          const priorId = visualBlocks[idx - 1].id;
          deleteBlock(blockId);
          
          setTimeout(() => {
            const priorEl = document.querySelector(`[data-block-id="${priorId}"]`) as HTMLElement;
            if (priorEl) {
              priorEl.focus();
              const sel = window.getSelection();
              if (sel) {
                const range = document.createRange();
                range.selectNodeContents(priorEl);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }
          }, 80);
        }
      }
    }
  };

  const formatText = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      let node: Node | null = sel.anchorNode;
      while (node) {
        if (node instanceof HTMLElement && node.contentEditable === "true") {
          const blockId = node.getAttribute("data-block-id");
          if (blockId) {
            updateBlockContent(blockId, node.innerHTML);
          }
          break;
        }
        node = node.parentNode;
      }
    }
  };

  const highlightText = (color: string) => {
    let className = "bg-amber-100 dark:bg-amber-500/25 px-1 rounded";
    if (color === "green") className = "bg-emerald-100 dark:bg-emerald-500/25 px-1 rounded";
    if (color === "pink") className = "bg-pink-100 dark:bg-pink-500/25 px-1 rounded";
    if (color === "blue") className = "bg-sky-100 dark:bg-sky-500/25 px-1 rounded";
    
    const sel = window.getSelection();
    if (sel && selectionRange) {
      document.execCommand("insertHTML", false, `<span class="${className}">${sel.toString()}</span>`);
      let node: Node | null = sel.anchorNode;
      while (node) {
        if (node instanceof HTMLElement && node.contentEditable === "true") {
          const blockId = node.getAttribute("data-block-id");
          if (blockId) {
            updateBlockContent(blockId, node.innerHTML);
          }
          break;
        }
        node = node.parentNode;
      }
    }
  };

  const renderVisualEditor = () => {
    const selectedFontFamily = getFontFamily(activeFont);

    return (
      <div className="relative w-full text-slate-800 dark:text-slate-200" data-visual-editor-canvas={true}>
        <style dangerouslySetInnerHTML={{ __html: `
          [data-visual-editor-canvas] [contenteditable]:empty::before {
            content: attr(data-placeholder);
            color: #94a3b8;
            opacity: 0.6;
            font-style: italic;
            cursor: text;
          }
          [data-visual-editor-canvas] .group {
            transition: background-color 0.2s ease;
            border-radius: 0.75rem;
            padding-left: 0.5rem;
            padding-right: 0.5rem;
            margin-left: -0.5rem;
            margin-right: -0.5rem;
          }
          [data-visual-editor-canvas] .group:hover {
            background-color: rgba(99, 102, 241, 0.03);
          }
          .dark [data-visual-editor-canvas] .group:hover {
            background-color: rgba(99, 102, 241, 0.02);
          }
        `}} />
        {/* Floating Bubble Formatting Toolbar */}
        {selectionMenuOpen && selectionMenuPos && (
          <div 
            className="fixed z-50 bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/50 px-2 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 animate-fade-in text-white pointer-events-auto"
            style={{
              top: `${selectionMenuPos.top}px`,
              left: `${selectionMenuPos.left}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <button 
              type="button"
              onClick={() => formatText("bold")}
              className="p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer text-xs font-bold w-7 h-7 flex items-center justify-center"
              title="Bold"
            >
              B
            </button>
            <button 
              type="button"
              onClick={() => formatText("italic")}
              className="p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer text-xs italic w-7 h-7 flex items-center justify-center font-serif"
              title="Italic"
            >
              I
            </button>
            <button 
              type="button"
              onClick={() => formatText("underline")}
              className="p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer text-xs underline w-7 h-7 flex items-center justify-center"
              title="Underline"
            >
              U
            </button>
            <button 
              type="button"
              onClick={() => formatText("strikeThrough")}
              className="p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer text-xs line-through w-7 h-7 flex items-center justify-center"
              title="Strikethrough"
            >
              S
            </button>
            
            <div className="w-px h-4 bg-slate-800 mx-1" />
            
            {/* Highlights */}
            <button 
              type="button"
              onClick={() => highlightText("yellow")}
              className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-500/80 border border-amber-400 cursor-pointer hover:scale-110 transition"
              title="Yellow Highlight"
            />
            <button 
              type="button"
              onClick={() => highlightText("green")}
              className="w-5 h-5 rounded-full bg-emerald-200 dark:bg-emerald-500/80 border border-emerald-400 cursor-pointer hover:scale-110 transition"
              title="Green Highlight"
            />
            <button 
              type="button"
              onClick={() => highlightText("pink")}
              className="w-5 h-5 rounded-full bg-pink-200 dark:bg-pink-500/80 border border-pink-400 cursor-pointer hover:scale-110 transition"
              title="Pink Highlight"
            />
            <button 
              type="button"
              onClick={() => highlightText("blue")}
              className="w-5 h-5 rounded-full bg-sky-200 dark:bg-sky-500/80 border border-sky-400 cursor-pointer hover:scale-110 transition"
              title="Blue Highlight"
            />
          </div>
        )}

        {/* Notion-style Handles Popup Dropdown */}
        {menuType && activeMenuBlockId && (
          <div 
            className="absolute z-50 bg-white/95 dark:bg-[#111726]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-2xl flex flex-col w-56 animate-fade-in text-slate-800 dark:text-slate-200 border-slate-200/50 dark:border-slate-800/80 pointer-events-auto"
            style={{
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
            }}
          >
            {menuType === "add" ? (
              <>
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Templates</div>
                <button 
                  type="button"
                  onClick={() => addBlock("p", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  <span className="text-sm">✍️</span> Paragraph
                </button>
                <button 
                  type="button"
                  onClick={() => addBlock("h2", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  <span className="text-sm">🏛️</span> Heading 2 (Topic)
                </button>
                <button 
                  type="button"
                  onClick={() => addBlock("h3", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  <span className="text-sm">📜</span> Heading 3
                </button>
                <button 
                  type="button"
                  onClick={() => addBlock("ul", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  <span className="text-sm">•</span> Bullet List
                </button>
                <button 
                  type="button"
                  onClick={() => addBlock("ol", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  <span className="text-sm">1.</span> Numbered List
                </button>
                <button 
                  type="button"
                  onClick={() => addBlock("quote", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  <span className="text-sm">💬</span> Quote Block
                </button>
                <button 
                  type="button"
                  onClick={() => addBlock("code", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  <span className="text-sm">💻</span> Code Block
                </button>
                <button 
                  type="button"
                  onClick={() => addBlock("hr", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  <span className="text-sm">➖</span> Divider Line
                </button>
              </>
            ) : (
              <>
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Transform</div>
                <button 
                  type="button"
                  onClick={() => convertBlock("p", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  Text block
                </button>
                <button 
                  type="button"
                  onClick={() => convertBlock("h2", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  Heading 2 (Topic)
                </button>
                <button 
                  type="button"
                  onClick={() => convertBlock("h3", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  Heading 3
                </button>
                <button 
                  type="button"
                  onClick={() => convertBlock("quote", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  Quote
                </button>
                <button 
                  type="button"
                  onClick={() => convertBlock("ul", activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 text-xs text-left cursor-pointer transition"
                >
                  Bullet List
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                <button 
                  type="button"
                  onClick={() => deleteBlock(activeMenuBlockId)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs text-left cursor-pointer transition font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Block
                </button>
              </>
            )}
          </div>
        )}

        {/* Parchment/Linen A4 Editing Page */}
        <div
          className="w-full shadow-2xl rounded-2xl mx-auto border border-slate-200/50 dark:border-slate-800/40 transition-all duration-300 relative overflow-visible"
          style={{
            maxWidth: `${pageWidth}px`,
            backgroundColor: "var(--app-card)",
            backgroundImage: isDark
              ? 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%), url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.08\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.05\'/%3E%3C/svg%3E")'
              : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.08) 100%), url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.04\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.09\'/%3E%3C/svg%3E")',
            minHeight: "1056px",
            fontFamily: selectedFontFamily,
          }}
        >
          <div className="px-12 py-14 sm:px-20 sm:py-18 h-full flex flex-col">
            <div className="flex-1 flex flex-col max-w-none break-words relative">
              {visualBlocks.map(block => (
                <div 
                  key={block.id}
                  className="group relative w-full flex items-start"
                  onMouseEnter={() => setHoveredBlockId(block.id)}
                  onMouseLeave={() => setHoveredBlockId(null)}
                >
                  {/* Left Controls Handle */}
                  <div className="absolute -left-12 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-40 select-none">
                    <button
                      type="button"
                      onClick={(e) => handleAddBlockClick(e, block.id)}
                      className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                      title="Add block below"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleBlockActionsClick(e, block.id)}
                      className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                      title="Block options"
                    >
                      <Columns className="h-3.5 w-3.5 rotate-90" />
                    </button>
                  </div>

                  {/* Visual Content Block */}
                  <div className="flex-1 min-w-0">
                    <VisualBlockItem
                      block={block}
                      onChange={updateBlockContent}
                      onFocus={setActiveBlockId}
                      onKeyDown={handleBlockKeyDown}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="border-t border-slate-200/80 pt-6 mt-16 flex justify-between text-[11px] text-slate-400 select-none font-medium" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <span>PrepAgent Editor</span>
              <span>{visualBlocks.length} active visual blocks</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handlePrintPdf = () => {
    setIsExportModalOpen(false);

    // Create a temporary hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    // Convert full markdown to beautiful semantic HTML
    const htmlBody = convertMarkdownToHtml(markdown);
    const title = subject || "Subject Notes";
    const activeFontFamily = getFontFamily(activeFont);

    // Write content to iframe with dedicated high-fidelity academic print styling
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page {
              size: letter;
              margin: 1in;
            }
            body {
              background: white !important;
              color: #111111 !important;
              padding: 0 !important;
              margin: 0 !important;
              font-family: ${activeFontFamily} !important;
              line-height: 1.6 !important;
              font-size: 11pt !important;
            }
            h1 {
              font-size: 24pt !important;
              color: #000000 !important;
              margin-top: 0 !important;
              margin-bottom: 12pt !important;
              border-bottom: 2px solid #e2e8f0 !important;
              padding-bottom: 8pt !important;
              page-break-after: avoid;
              font-family: system-ui, -apple-system, sans-serif !important;
              font-weight: bold !important;
            }
            h2 {
              font-size: 16pt !important;
              color: #4f46e5 !important;
              border-left: 4px solid #4f46e5 !important;
              padding-left: 8pt !important;
              margin-top: 24pt !important;
              margin-bottom: 8pt !important;
              page-break-after: avoid;
              font-family: system-ui, -apple-system, sans-serif !important;
              font-weight: bold !important;
            }
            h3 {
              font-size: 13pt !important;
              color: #1a1a1a !important;
              margin-top: 18pt !important;
              margin-bottom: 6pt !important;
              page-break-after: avoid;
              font-family: system-ui, -apple-system, sans-serif !important;
              font-weight: bold !important;
            }
            p {
              margin-top: 0 !important;
              margin-bottom: 10pt !important;
              text-align: justify !important;
            }
            ul, ol {
              margin-top: 0 !important;
              margin-bottom: 12pt !important;
              padding-left: 20pt !important;
            }
            li {
              margin-bottom: 4pt !important;
              text-align: justify !important;
            }
            blockquote {
              font-style: italic !important;
              background-color: #fffbeb !important;
              border-left: 4px solid #f59e0b !important;
              padding: 10pt 14pt !important;
              margin: 14pt 0 !important;
              border-radius: 4px !important;
              color: #451a03 !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin: 16pt 0 !important;
              page-break-inside: avoid !important;
            }
            th, td {
              border: 0.5pt solid #cccccc !important;
              padding: 6pt 8pt !important;
              font-size: 10pt !important;
            }
            th {
              background-color: #f3f4f6 !important;
              font-weight: bold !important;
              color: #000000 !important;
            }
            .sources {
              font-size: 9pt !important;
              color: #666666 !important;
              font-style: italic !important;
              margin-bottom: 16pt !important;
              font-family: system-ui, -apple-system, sans-serif !important;
            }
            tr, img, li {
              page-break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          <h1>${title} Notes</h1>
          ${htmlBody}
        </body>
      </html>
    `);
    doc.close();

    // Trigger printing once content is ready
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Clean up DOM
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 200);
  };

  const renderTTSPlayer = () => {
    const fontOptions: DropdownOption[] = [
      { value: "garamond", label: "EB Garamond", icon: "📜", description: "Warm book serif" },
      { value: "caveat", label: "Cozy Cursive", icon: "✍️", description: "Soft journal script" },
      { value: "architect", label: "Architect Hand", icon: "📐", description: "Technical hand-lettering" },
      { value: "cinzel", label: "Classical Roman", icon: "🏛️", description: "Roman display serif" },
      { value: "georgia", label: "Georgia Book", icon: "📚", description: "Standard book serif" },
      { value: "sans", label: "Modern Sans", icon: "🌐", description: "High legibility screen" },
    ];

    return (
      <div 
        className="w-full mx-auto mb-4 bg-white/95 dark:bg-[#111726]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl shadow-xl flex flex-wrap items-center gap-4 transition-all duration-300 select-none text-slate-800 dark:text-slate-200 shrink-0 relative z-30"
        style={{ maxWidth: `${pageWidth}px` }}
      >
        <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-slate-800 shrink-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isPlaying ? "bg-emerald-500 animate-pulse" : isPaused ? "bg-amber-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600"}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {isPlaying ? `Speaking block ${currentBlockIndex !== null ? currentBlockIndex + 1 : ""}` : isPaused ? "Paused" : "Notes TTS"}
          </span>
        </div>

        {/* Audio controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isPlaying ? (
            <button
              onClick={handlePauseTTS}
              className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition cursor-pointer animate-fade-in"
              title="Pause Reading"
            >
              <Pause className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handlePlayTTS}
              className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition cursor-pointer animate-fade-in"
              title="Play Reading"
            >
              <Play className="h-4 w-4 shrink-0 fill-current" />
            </button>
          )}
          
          <button
            onClick={handleStopTTS}
            disabled={!isPlaying && !isPaused}
            className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-300 dark:disabled:text-slate-700 transition cursor-pointer disabled:cursor-not-allowed"
            title="Stop Reading"
          >
            <Square className="h-4 w-4 shrink-0 fill-current" />
          </button>
        </div>

        {/* Voice Selection */}
        {voices.length > 0 && (
          <div className="w-40 sm:w-48 shrink-0">
            <CustomDropdown
              options={voices.map(v => ({
                value: v.voiceURI,
                label: v.name.replace(/Microsoft|Google|Apple/g, "").trim(),
                icon: "🗣️",
                description: v.lang
              }))}
              value={selectedVoice}
              onChange={handleVoiceChange}
              placeholder="Select Speech Voice"
            />
          </div>
        )}

        {/* Speed Slider */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 select-none">Speed</span>
          <input 
            type="range" 
            min="0.5" 
            max="2.0" 
            step="0.1" 
            value={speechRate} 
            onChange={(e) => handleRateChange(parseFloat(e.target.value))} 
            className="w-14 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 w-8">{speechRate}x</span>
        </div>

        {/* Typography CustomDropdown */}
        <div className="w-40 sm:w-44 shrink-0 border-l border-slate-200 dark:border-slate-800 pl-2">
          <CustomDropdown
            options={fontOptions}
            value={activeFont}
            onChange={setActiveFont}
            placeholder="Select Font"
          />
        </div>

        {/* Page Width Slider */}
        <div className="flex items-center gap-2 shrink-0 border-l border-slate-200 dark:border-slate-800 pl-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 select-none">Width</span>
          <input 
            type="range" 
            min="600" 
            max="1200" 
            step="10" 
            value={pageWidth} 
            onChange={(e) => setPageWidth(parseInt(e.target.value))} 
            className="w-20 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 w-12">{pageWidth}px</span>
        </div>
      </div>
    );
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

  // Search Node
  const handleSearchNode = (query: string) => {
  };

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
      if (!isAnnotating && !isRestructuring && !socraticAnswer) {
        setSelectedText("");
        setPopoverPosition(null);
      }
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 0) {
      const range = selection.getRangeAt(0);
      const container = previewContainerRef.current;
      
      // Ensure selection is inside preview container
      if (container && container.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        setSelectedText(text);
        setPopoverPosition({
          top: rect.top + window.scrollY - 52, // 52px above selection
          left: rect.left + window.scrollX + rect.width / 2, // centered
        });
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
    const findMarkdownTextRange = (md: string, sel: string): { startIdx: number; endIdx: number } | null => {
      const exactIdx = md.indexOf(sel);
      if (exactIdx !== -1) {
        return { startIdx: exactIdx, endIdx: exactIdx + sel.length };
      }

      const cleanString = (str: string) => str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const cleanSelected = cleanString(sel);
      if (!cleanSelected) return null;

      const mdLen = md.length;
      const cleanToRawIdx: number[] = [];
      let cleanMd = "";

      for (let i = 0; i < mdLen; i++) {
        const char = md[i];
        if (/[a-zA-Z0-9]/.test(char)) {
          cleanMd += char.toLowerCase();
          cleanToRawIdx.push(i);
        }
      }

      const matchIdx = cleanMd.indexOf(cleanSelected);
      if (matchIdx !== -1) {
        const sIdx = cleanToRawIdx[matchIdx];
        const cleanEndIdx = matchIdx + cleanSelected.length - 1;
        const eIdx = cleanToRawIdx[cleanEndIdx] + 1;
        return { startIdx: sIdx, endIdx: eIdx };
      }

      return null;
    };

    const range = findMarkdownTextRange(markdown, selectedText);
    if (!range) {
      alert("Could not locate the selected text in the original notes markdown. It might have been modified.");
      return;
    }

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
      fetchSubjectNotes(activeSubj);
      loadMindmap(activeSubj);
      fetchHighlights(activeSubj);
    }
  }, []);

  const fetchSubjectNotes = async (subjName: string) => {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/subject?subject=${encodeURIComponent(subjName)}`, {
        method: "GET",
        headers: getAIHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMarkdown(data.markdown);
        setTopics(data.topics || []);
        setSources(data.sources || []);
      } else {
        setErrorMessage(data.error || "Failed to load subject notes.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error loading subject notes.");
    } finally {
      setLoading(false);
    }
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
    if (topics.length === 0) {
      setErrorMessage("No topics available to generate mindmap.");
      return;
    }
    
    setLoadingMindmap(true);
    setErrorMessage("");
    try {
      // Generate mindmap for each topic
      for (const topic of topics) {
        await fetch("/api/mindmaps/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, topic: topic.title })
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
    const lines = markdown.split("\n");
    const parsedTopics: TopicNode[] = [];

    let currentTopic: TopicNode | null = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith("## ")) {
        if (currentTopic) {
          parsedTopics.push(currentTopic);
        }

        const headerText = trimmed.substring(3).trim();
        const rawTopic = headerText.startsWith("Topic:") ? headerText.substring(6).trim() : headerText;
        
        let cleanedTopic = rawTopic;
        if (rawTopic.includes(" - ")) {
          const parts = rawTopic.split(" - ");
          cleanedTopic = parts.slice(1).join(" - ").trim();
        }

        currentTopic = {
          name: cleanedTopic,
          fullName: rawTopic,
          sources: [],
          subsections: []
        };
      } else if (trimmed.startsWith("### ")) {
        if (currentTopic) {
          const subName = trimmed.substring(4).trim();
          currentTopic.subsections.push({
            name: subName,
            fullName: subName
          });
        }
      } else if (trimmed.startsWith("* **Sources**:")) {
        if (currentTopic) {
          const match = trimmed.match(/\* \*\*Sources\*\*:\s*(.*)/);
          if (match && match[1]) {
            currentTopic.sources = match[1].split(",").map(s => s.trim());
          }
        }
      }
    });

    if (currentTopic) {
      parsedTopics.push(currentTopic);
    }

    setTopics(parsedTopics);
  }, [markdown]);

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
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Subject_${subject.replace(/\s+/g, "_")}_Notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Insert a new section at cursor position
  const handleInsertSection = () => {
    const template = `\n## Topic: New Chapter Title\n* **Sources**: Manual Addition\n\nWrite your notes content here...\n\n---\n`;

    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = textareaRef.current.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);

      const newMarkdown = before + template + after;
      setMarkdown(newMarkdown);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const targetPos = start + 12;
          textareaRef.current.setSelectionRange(targetPos, targetPos + 17);
        }
      }, 50);
    } else {
      setMarkdown(prev => prev + template);
    }
  };

  // Scroll to selected topic heading inside the rendered preview
  const handleScrollToTopic = (fullName: string, topicName: string) => {
    if (activeTab === "edit" && textareaRef.current) {
      const targetHeader = `## Topic: ${fullName}`;
      const altHeader = `## ${fullName}`;
      const targetHeaderShort = `## Topic: ${topicName}`;
      const altHeaderShort = `## ${topicName}`;
      
      const subHeader = `### ${fullName}`;
      const subHeaderShort = `### ${topicName}`;
      
      let startIdx = markdown.indexOf(targetHeader);
      if (startIdx === -1) startIdx = markdown.indexOf(altHeader);
      if (startIdx === -1) startIdx = markdown.indexOf(targetHeaderShort);
      if (startIdx === -1) startIdx = markdown.indexOf(altHeaderShort);
      if (startIdx === -1) startIdx = markdown.indexOf(subHeader);
      if (startIdx === -1) startIdx = markdown.indexOf(subHeaderShort);
      
      if (startIdx !== -1) {
        textareaRef.current.focus();
        let matchedHeader = targetHeader;
        if (markdown.indexOf(altHeader) === startIdx) matchedHeader = altHeader;
        else if (markdown.indexOf(targetHeaderShort) === startIdx) matchedHeader = targetHeaderShort;
        else if (markdown.indexOf(altHeaderShort) === startIdx) matchedHeader = altHeaderShort;
        else if (markdown.indexOf(subHeader) === startIdx) matchedHeader = subHeader;
        else if (markdown.indexOf(subHeaderShort) === startIdx) matchedHeader = subHeaderShort;
        
        textareaRef.current.setSelectionRange(startIdx, startIdx + matchedHeader.length);
        const lineHeight = 20;
        const lineCount = markdown.substring(0, startIdx).split("\n").length;
        textareaRef.current.scrollTop = lineCount * lineHeight - 100;
      }
      return;
    }

    if (previewContainerRef.current) {
      const escapedFull = encodeURIComponent(fullName);
      const escapedShort = encodeURIComponent(topicName);
      let targetElement = previewContainerRef.current.querySelector(`[data-topic-id="${escapedFull}"]`);
      if (!targetElement) {
        targetElement = previewContainerRef.current.querySelector(`[data-topic-id="${escapedShort}"]`);
      }
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
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

  // --- Clean, Highly Tailored Markdown React Renderer for the Paper Preview ---
  const renderMarkdownContent = (text: string) => {
    // Normalization: clean up consecutive back-to-back dividers or spacing
    const normalizedText = text.replace(/\n\s*---\s*\n/g, "\n---\n");
    const blocks = normalizedText.split("\n\n");
    const renderedElements: React.JSX.Element[] = [];

    // Curated Academic Serif Typography Scheme (warm book color tone)
    const textStyle = { 
      color: isDark ? '#e2e8f0' : '#1a1d20', // Dynamic text color matching global theme
      lineHeight: '1.7',
    };

    // Sort highlights by length descending so longer matching spans highlight first
    const sortedHighlights = [...highlights].sort((a, b) => b.text.length - a.text.length);

    const getHighlightColorClass = (color: string) => {
      switch (color) {
        case "green":
          return isDark 
            ? "bg-emerald-500/25 text-emerald-100 border-emerald-500/20" 
            : "bg-emerald-100 text-emerald-950 border-emerald-300";
        case "pink":
          return isDark 
            ? "bg-pink-500/25 text-pink-100 border-pink-500/20" 
            : "bg-pink-100 text-pink-950 border-pink-300";
        case "blue":
          return isDark 
            ? "bg-sky-500/25 text-sky-100 border-sky-500/20" 
            : "bg-sky-100 text-sky-950 border-sky-300";
        case "yellow":
        default:
          return isDark 
            ? "bg-amber-500/25 text-amber-200 border-amber-500/20" 
            : "bg-amber-100 text-amber-950 border-amber-300";
      }
    };

    // Helper to recursively parse and overlay highlights on React text nodes
    const applyHighlights = (node: React.ReactNode, keyPrefix: string): React.ReactNode => {
      if (typeof node !== "string") {
        if (Array.isArray(node)) {
          return node.map((child, idx) => applyHighlights(child, `${keyPrefix}-${idx}`));
        }
        if (node && React.isValidElement(node)) {
          const children = (node.props as any).children;
          if (children) {
            return React.cloneElement(node, {
              key: keyPrefix,
            } as any, applyHighlights(children, `${keyPrefix}-child`));
          }
          return node;
        }
        return node;
      }

      const text = node;
      if (!text.trim()) return text;

      // Find the first highlight that matches this text fragment
      const match = sortedHighlights.find(h => text.toLowerCase().includes(h.text.toLowerCase()));
      if (!match) return text;

      const startIdx = text.toLowerCase().indexOf(match.text.toLowerCase());
      const endIdx = startIdx + match.text.length;
      
      const beforeText = text.substring(0, startIdx);
      const matchedText = text.substring(startIdx, endIdx);
      const afterText = text.substring(endIdx);

      const colorClass = getHighlightColorClass(match.color);
      const result = [
        beforeText ? applyHighlights(beforeText, `${keyPrefix}-b`) : null,
        <span 
          key={`${keyPrefix}-hl-${match.id}`}
          className={`inline relative group border rounded-sm px-1 py-0.5 transition duration-150 cursor-pointer ${colorClass}`}
          title={match.note ? `Note: ${match.note}` : "Highlight"}
        >
          {matchedText}
          {match.note && (
            <span className="inline-flex items-center justify-center shrink-0 ml-1 bg-white dark:bg-slate-800 text-slate-500 rounded-full w-4 h-4 shadow-sm border border-slate-200 dark:border-slate-700 text-[9px] select-none align-middle">
              💬
            </span>
          )}
          
          {match.note && (
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-3 bg-slate-900/95 dark:bg-slate-950/95 border border-slate-700 dark:border-slate-800 text-white text-[11px] rounded-lg shadow-xl backdrop-blur-md z-40 text-left font-sans select-none leading-relaxed transition-opacity">
              <strong className="block text-[9px] uppercase tracking-wider text-slate-400 mb-1 border-b border-slate-800 pb-1">📌 Sticky Comment</strong>
              {match.note}
            </span>
          )}
        </span>,
        afterText ? applyHighlights(afterText, `${keyPrefix}-a`) : null
      ];

      return result.filter(r => r !== null);
    };

    // Helpler to parse inline markdown bold (**text**), italics (*text*), and raw characters
    const renderInlineFormatting = (content: string, keyPrefix: string) => {
      if (!content) return [];
      
      // Split on bold syntax first
      const boldParts = content.split("**");
      return boldParts.flatMap((bPart, bIdx) => {
        const isBold = bIdx % 2 === 1;
        
        // Inside bold part or normal part, look for italic syntax
        const italicParts = bPart.split("*");
        const renderedItalicParts = italicParts.map((iPart, iIdx) => {
          const isItalic = iIdx % 2 === 1;
          if (isItalic) {
            return <em key={`${keyPrefix}-it-${bIdx}-${iIdx}`} className="italic">{iPart}</em>;
          }
          return iPart;
        });

        if (isBold) {
          // Yellow highlight style
          const bgStyle = isDark 
            ? "bg-amber-500/25 text-amber-200 border-amber-500/20" 
            : "bg-amber-500/15 text-amber-950 border-amber-500/10";
          return (
            <strong key={`${keyPrefix}-b-${bIdx}`} className={`font-extrabold px-1.5 py-0.5 rounded-sm inline border ${bgStyle}`}>
              {renderedItalicParts}
            </strong>
          );
        }
        return renderedItalicParts;
      });
    };

    // Helper to parse lists (handles nested bullet markers and headers)
    const parseListItem = (line: string, keyPrefix: string) => {
      const cleanLine = line.replace(/^[-*•]\s+/, "").trim();
      return renderInlineFormatting(cleanLine, keyPrefix);
    };

    let blockKey = 0;
    
    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b].trim();
      if (!block) continue;
      blockKey++;

      // Divider block
      if (block === "---") {
        renderedElements.push(
          <div key={`div-${blockKey}`} className="my-10 flex justify-center text-slate-300 dark:text-slate-700 tracking-[1em] select-none">
            🜂 🜃 🜁
          </div>
        );
        continue;
      }

      // Check if block is a Table structure
      if (block.startsWith("|")) {
        const rows = block.split("\n").map(r => r.trim()).filter(r => r.startsWith("|"));
        if (rows.length >= 2) {
          // Parse rows
          const parsedRows = rows.map(r => {
            return r.split("|").slice(1, -1).map(cell => cell.trim());
          });
          
          // Separate header and body
          const headers = parsedRows[0];
          const hasSeparator = rows[1].includes("-");
          const bodyRows = hasSeparator ? parsedRows.slice(2) : parsedRows.slice(1);

          renderedElements.push(
            <div key={`table-wrapper-${blockKey}`} className="group flex items-start gap-2 w-full relative justify-between">
              <div 
                className={`my-6 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50 flex-1 transition-all duration-300 ${
                  currentBlockIndex === b 
                    ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 p-2 -mx-2 shadow-sm" 
                    : ""
                }`}
              >
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                      {headers.map((h, idx) => (
                        <th key={`th-${idx}`} className="px-4 py-3 font-bold text-slate-900 dark:text-white" style={{ fontFamily: '"Book Antiqua", serif' }}>
                          {applyHighlights(renderInlineFormatting(h, `th-${blockKey}-${idx}`), `th-${blockKey}-${idx}-hl`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bodyRows.map((row, rIdx) => (
                      <tr key={`tr-${rIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        {row.map((cell, cIdx) => (
                          <td key={`td-${cIdx}`} className="px-4 py-3 text-slate-700 dark:text-slate-300 leading-relaxed">
                            {applyHighlights(renderInlineFormatting(cell, `td-${blockKey}-${rIdx}-${cIdx}`), `td-${blockKey}-${rIdx}-${cIdx}-hl`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isPlayingRef.current = true;
                  speakBlock(b);
                }}
                className="mt-8 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
                title="Read table block"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
          continue;
        }
      }

      // Check if block is entirely a list of items
      const lines = block.split("\n");
      const isListBlock = lines.every(l => l.trim().startsWith("- ") || l.trim().startsWith("* ") || l.trim().startsWith("• "));
      
      if (isListBlock) {
        renderedElements.push(
          <div key={`ul-wrapper-${blockKey}`} className="group flex items-start gap-2 w-full relative justify-between">
            <ul 
              className={`ml-6 list-disc space-y-2.5 my-5 flex-1 transition-all duration-300 ${
                currentBlockIndex === b 
                  ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 rounded p-2 -mx-2 shadow-sm animate-pulse" 
                  : ""
              }`} 
              style={textStyle}
            >
              {lines.map((l, lIdx) => (
                <li key={lIdx} className="pl-1 leading-relaxed text-justify" style={{ fontSize: `${fontSize}px` }}>
                  {applyHighlights(parseListItem(l, `li-${blockKey}-${lIdx}`), `li-${blockKey}-${lIdx}-hl`)}
                </li>
              ))}
            </ul>
            <button
              onClick={(e) => {
                e.stopPropagation();
                isPlayingRef.current = true;
                speakBlock(b);
              }}
              className="mt-5 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
              title="Read list block"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
        continue;
      }

      // Check if single line headers/special items
      const firstLine = lines[0].trim();

      // Subject Main Header
      if (firstLine.startsWith("# Subject:")) {
        const subj = firstLine.replace("# Subject:", "").trim();
        renderedElements.push(
          <div key={`header-wrapper-${blockKey}`} className="group flex items-start justify-between gap-3 mb-10 pb-6 border-b-2 border-indigo-100 dark:border-indigo-950/40 w-full relative">
            <div 
              className={`flex-1 transition-all duration-300 ${
                currentBlockIndex === b 
                  ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 rounded p-2 shadow-sm" 
                  : ""
              }`}
              style={textStyle}
            >
              <h1 className="font-bold tracking-tight text-slate-900 dark:text-white" style={{ fontSize: `${fontSize * 2.2}px`, lineHeight: 1.2 }}>{applyHighlights(subj, `subj-hl`)}</h1>
              <p className="mt-2 text-indigo-600/70 dark:text-indigo-400/50 font-medium tracking-wide uppercase text-[10px]" style={{ fontFamily: 'system-ui, sans-serif' }}>Comprehensive Organized Study Notes</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                isPlayingRef.current = true;
                speakBlock(b);
              }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
              title="Read heading block"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
        continue;
      }

      // Topic Heading (H2)
      if (firstLine.startsWith("## ")) {
        const heading = firstLine.replace("## ", "").trim();
        const displayHeading = heading.startsWith("Topic:") ? heading.replace("Topic:", "").trim() : heading;
        renderedElements.push(
          <div key={`h2-wrapper-${blockKey}`} className="group flex items-center justify-between gap-3 mt-12 mb-4 scroll-mt-6 w-full relative">
            <h2
              data-topic-id={encodeURIComponent(displayHeading)}
              className={`font-bold border-l-4 border-indigo-500 pl-3.5 py-0.5 text-indigo-900 dark:text-indigo-200 transition-all duration-300 flex-1 ${
                currentBlockIndex === b 
                  ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 rounded px-2 shadow-sm animate-pulse" 
                  : ""
              }`}
              style={{ ...textStyle, fontSize: `${fontSize * 1.5}px` }}
            >
              {applyHighlights(displayHeading, `h2-${blockKey}-hl`)}
            </h2>
            <button
              onClick={(e) => {
                e.stopPropagation();
                isPlayingRef.current = true;
                speakBlock(b);
              }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
              title="Read heading"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
        continue;
      }

      // Subheading (H3)
      if (firstLine.startsWith("### ")) {
        const h3Text = firstLine.replace("### ", "").trim();
        renderedElements.push(
          <div key={`h3-wrapper-${blockKey}`} className="group flex items-center justify-between gap-3 mt-8 mb-3 w-full relative">
            <h3 
              data-topic-id={encodeURIComponent(h3Text)}
              className={`font-semibold text-slate-900 dark:text-slate-100 transition-all duration-300 flex-1 ${
                currentBlockIndex === b 
                  ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 rounded px-2 shadow-sm animate-pulse" 
                  : ""
              }`} 
              style={{ ...textStyle, fontSize: `${fontSize * 1.25}px` }}
            >
              {applyHighlights(h3Text, `h3-${blockKey}-hl`)}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                isPlayingRef.current = true;
                speakBlock(b);
              }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
              title="Read subheading"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
        continue;
      }

      // Sources citation (small italic link banner)
      if (firstLine.startsWith("* **Sources**:")) {
        const match = firstLine.match(/\* \*\*Sources\*\*:\s*(.*)/);
        const sourcesText = match ? match[1].trim() : "";
        renderedElements.push(
          <div key={`src-wrapper-${blockKey}`} className="group flex items-center justify-between gap-3 w-full relative">
            <div 
              className={`flex items-center gap-2 mb-6 -mt-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 px-3 py-1.5 rounded-lg w-fit transition-all duration-300 ${
                currentBlockIndex === b 
                  ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20" 
                  : ""
              }`}
            >
              <BookMarked className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span className="font-medium text-slate-500 dark:text-slate-400" style={{ fontFamily: 'system-ui, sans-serif', fontSize: `${fontSize * 0.75}px` }}>
                Source Material: <span className="italic font-normal">{sourcesText || "Manual Entry"}</span>
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                isPlayingRef.current = true;
                speakBlock(b);
              }}
              className="mb-6 -mt-2 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
              title="Read source citation"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
        continue;
      }

      // Blockquotes (styled study card callout)
      if (firstLine.startsWith("> ")) {
        const quoteContent = lines.map(l => l.replace(/^>\s?/, "").trim()).join("\n");
        renderedElements.push(
          <div key={`quote-wrapper-${blockKey}`} className="group flex items-start gap-2 w-full relative justify-between">
            <div 
              className={`ml-2 mr-2 my-6 pl-5 border-l-4 border-amber-500 bg-amber-50/40 dark:bg-amber-950/10 py-3 pr-4 rounded-r-lg text-slate-800 dark:text-slate-200 leading-relaxed italic flex-1 transition-all duration-300 ${
                currentBlockIndex === b 
                  ? "ring-2 ring-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20 shadow-sm animate-pulse" 
                  : ""
              }`}
              style={{ ...textStyle, fontSize: `${fontSize * 0.95}px` }}
            >
              {applyHighlights(renderInlineFormatting(quoteContent, `q-${blockKey}`), `q-${blockKey}-hl`)}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                isPlayingRef.current = true;
                speakBlock(b);
              }}
              className="mt-8 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
              title="Read blockquote"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
        continue;
      }

      // Default: Paragraph
      renderedElements.push(
        <div key={`p-wrapper-${blockKey}`} className="group flex items-start gap-2 w-full relative justify-between">
          <p 
            className={`my-4.5 leading-relaxed text-justify flex-1 transition-all duration-300 ${
              currentBlockIndex === b 
                ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 rounded p-2 -mx-2 shadow-sm scale-[1.01] animate-pulse" 
                : ""
            }`}
            style={{ ...textStyle, fontSize: `${fontSize}px` }}
          >
            {applyHighlights(renderInlineFormatting(block, `p-${blockKey}`), `p-${blockKey}-hl`)}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              isPlayingRef.current = true;
              speakBlock(b);
            }}
            className="mt-5 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
            title="Read paragraph"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }

    return renderedElements;
  };

  // Preview panel content (used in both normal and focus mode)
  const renderDocumentPreview = () => {
    const selectedFontFamily = getFontFamily(activeFont);

    return (
      <div
        ref={previewContainerRef}
        onMouseUp={handleTextSelection}
        className="w-full shadow-2xl rounded-2xl mx-auto border border-slate-200/50 dark:border-slate-800/40 transition-all duration-300 relative overflow-hidden"
        style={{
          maxWidth: `${pageWidth}px`,
          backgroundColor: "var(--app-card)",
          backgroundImage: isDark
            ? 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%), url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.08\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.05\'/%3E%3C/svg%3E")'
            : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.08) 100%), url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.04\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.09\'/%3E%3C/svg%3E")',
          minHeight: "1056px", // letter size aspect proportion
          fontFamily: selectedFontFamily,
        }}
      >
        <div className="px-10 py-14 sm:px-16 sm:py-18 h-full flex flex-col">
        {/* Content */}
        <div className="flex-1 flex flex-col max-w-none break-words">
          {markdown.trim() ? (
            renderMarkdownContent(markdown)
          ) : (
            <div className="my-auto text-center p-12 flex flex-col items-center gap-4 text-slate-400 dark:text-slate-500" style={{ fontFamily: '"Book Antiqua", serif' }}>
              <BookOpen className="h-12 w-12 opacity-50 text-indigo-500" />
              <h3 className="font-semibold text-xl text-slate-900 dark:text-white">No notes yet</h3>
              <p className="text-sm max-w-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Switch to the Editor to start writing your study notes.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200/80 pt-6 mt-16 flex justify-between text-[11px] text-slate-400 select-none font-medium" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <span>PrepAgent System</span>
          <span>{topics.length} organized chapters</span>
        </div>
      </div>
    </div>
  );
};

  return (
    <>
      {/* ── Normal Layout ── */}
      <div className="flex min-h-screen bg-slate-50 dark:bg-[#0b0f19]">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar />
          
          <main className="flex-1 overflow-hidden flex flex-col h-screen relative">
          
          {/* ── Header Toolbar ── */}
          <header className="px-5 py-3 bg-white dark:bg-[#111726] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-3">
              <a
                href="/library"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition"
              >
                <ArrowLeft className="h-4 w-4" />
              </a>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{subject}</h1>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Study notes &amp; chapters</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Tabs */}
              <div className="p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center gap-0.5 mr-2">
                {([
                  { key: "preview" as const, icon: Eye, label: "Preview" },
                  { key: "edit" as const, icon: Edit3, label: "Editor" },
                  { key: "split" as const, icon: Columns, label: "Split" },
                  { key: "visual" as const, icon: Sparkles, label: "Visual Editor" },
                  { key: "mindmap" as const, icon: Network, label: "Mindmap" },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === tab.key
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Font Size & Focus Controls (Only visible when preview/split/visual/mindmap is active) */}
              {(activeTab === "preview" || activeTab === "split" || activeTab === "visual" || activeTab === "mindmap") && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg mr-2">
                  <button 
                    onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded transition"
                    title="Decrease font size"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs font-mono w-6 text-center text-slate-600 dark:text-slate-300 select-none">{fontSize}</span>
                  <button 
                    onClick={() => setFontSize(Math.min(32, fontSize + 2))}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded transition"
                    title="Increase font size"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
                  <button 
                    onClick={() => setFocusMode(true)}
                    className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded transition flex items-center gap-1"
                    title="Focus Mode"
                  >
                    <Maximize className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

              {/* Action Buttons */}
              <button
                onClick={handleInsertSection}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5 text-indigo-500" /> Add
              </button>

              <button
                onClick={() => setIsExportModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 text-xs font-medium"
              >
                <Download className="h-3.5 w-3.5 text-indigo-500" /> Export
              </button>

              <button
                onClick={handleSaveNotes}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold text-xs shrink-0 transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" /> Save
                  </>
                )}
              </button>
            </div>
          </header>

          {/* ── Notifications ── */}
          {saveSuccess && (
            <div className="bg-emerald-500 text-white px-6 py-2 flex items-center gap-2 justify-center font-medium text-xs shrink-0">
              <CheckCircle2 className="h-4 w-4" /> Notes saved and indexed successfully.
            </div>
          )}
          {errorMessage && (
            <div className="bg-rose-500 text-white px-6 py-2 flex items-center gap-2 justify-center font-medium text-xs shrink-0">
              <AlertCircle className="h-4 w-4" /> {errorMessage}
            </div>
          )}

          {/* ── Main Workspace ── */}
          <div className="flex-1 flex overflow-hidden w-full relative">

            {/* ── TOC Sidebar ── */}
            <aside
              className={`bg-white dark:bg-[#111726] border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 shrink-0 select-none ${
                tocCollapsed ? "w-0 overflow-hidden" : "w-60"
              }`}
            >
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1.5">
                  <List className="h-3.5 w-3.5 text-indigo-500" /> Contents
                </span>
                <span className="text-[10px] font-medium text-slate-300 dark:border-slate-600">{topics.length} chapters</span>
              </div>

              {/* Sidebar Tabs */}
              <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1 shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
                <button
                  onClick={() => setSidebarTab("chapters")}
                  className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer text-center ${
                    sidebarTab === "chapters"
                      ? "bg-white dark:bg-slate-750 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-600"
                      : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Chapters
                </button>
                <button
                  onClick={() => setSidebarTab("highlights")}
                  className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1 text-center ${
                    sidebarTab === "highlights"
                      ? "bg-white dark:bg-slate-750 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-600"
                      : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Highlights {highlights.length > 0 && (
                    <span className="inline-flex items-center justify-center bg-indigo-500 text-white rounded-full w-4 h-4 text-[8px] font-bold select-none">
                      {highlights.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2 select-text">
                {sidebarTab === "chapters" ? (
                  // --- Chapters TOC ---
                  topics.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 italic leading-relaxed select-none">
                      No chapters found. Add a topic section to get started.
                    </div>
                  ) : (
                    topics.map((t, idx) => {
                      const isEditing = editingTopicName === t.name;
                      return (
                        <div key={idx} className="w-full flex flex-col select-none group border-b border-slate-100/50 dark:border-slate-800/20 pb-2">
                          {/* Parent Chapter Item */}
                          <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition duration-150 relative">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleRenameTopic(t.name, t.fullName, editValue)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleRenameTopic(t.name, t.fullName, editValue);
                                  } else if (e.key === "Escape") {
                                    setEditingTopicName(null);
                                  }
                                }}
                                className="flex-1 px-1.5 py-0.5 border border-indigo-500 rounded bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-slate-900 dark:text-slate-100 font-medium"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <button
                                onClick={() => handleScrollToTopic(t.fullName, t.name)}
                                className="flex-1 text-left flex items-start gap-2 min-w-0 cursor-pointer"
                              >
                                <span className="text-[10px] font-extrabold text-indigo-500 dark:text-indigo-400 mt-px w-4 shrink-0 text-right">{idx + 1}</span>
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate leading-snug font-bold hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t.name}</span>
                                  {t.sources.length > 0 && (
                                    <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 block truncate mt-0.5 uppercase tracking-wider">
                                      📂 {t.sources.join(", ")}
                                    </span>
                                  )}
                                </div>
                              </button>
                            )}
                            
                            {/* Sidebar Operations Button Cluster (Rename & Delete) */}
                            {!isEditing && (
                              <div className="flex items-center gap-0.5 ml-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTopicName(t.name);
                                    setEditValue(t.name);
                                  }}
                                  className="p-1 rounded hover:bg-indigo-500/10 hover:text-indigo-500 text-slate-400 transition cursor-pointer"
                                  title="Rename Chapter"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTopic(t.name);
                                  }}
                                  className="p-1 rounded hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 transition cursor-pointer"
                                  title="Delete Chapter"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Nested Tree Outline (Sub-headings / sections) */}
                          {t.subsections && t.subsections.length > 0 && (
                            <div className="pl-4 pr-2 mt-0.5 border-l border-slate-200/60 dark:border-slate-800/80 ml-5 py-0.5 space-y-1 text-[11px] font-medium">
                              {t.subsections.map((sub, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => handleScrollToTopic(sub.fullName, sub.name)}
                                  className="w-full text-left truncate py-0.5 px-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer block transition duration-150 relative truncate"
                                  title={sub.name}
                                >
                                  <span className="text-[10px] text-slate-400 dark:text-slate-600 mr-1 select-none">├─</span>
                                  <span className="truncate">{sub.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )
                ) : (
                  // --- Highlights & Personal Study Comments Feed ---
                  highlights.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 italic leading-relaxed select-none">
                      No highlights yet. Select notes text to highlight.
                    </div>
                  ) : (
                    highlights.map((h) => (
                      <div
                        key={h.id}
                        className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 transition select-none group relative bg-white dark:bg-[#151c2e] hover:shadow-sm cursor-pointer animate-fade-in ${
                          h.color === "green" 
                            ? "border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-300"
                            : h.color === "pink"
                            ? "border-pink-200 dark:border-pink-900/50 hover:border-pink-300"
                            : h.color === "blue"
                            ? "border-sky-200 dark:border-sky-900/50 hover:border-sky-300"
                            : "border-amber-200 dark:border-amber-900/50 hover:border-amber-300"
                        }`}
                        onClick={() => {
                          // Quick scroll note preview to matched highlight snippet
                          if (previewContainerRef.current) {
                            const matchElements = Array.from(previewContainerRef.current.querySelectorAll("span"));
                            const matchedSpan = matchElements.find(el => el.textContent?.trim().toLowerCase() === h.text.trim().toLowerCase());
                            if (matchedSpan) {
                              matchedSpan.scrollIntoView({ behavior: "smooth", block: "center" });
                              // Simple highlight flash animation
                              matchedSpan.classList.add("scale-105", "shadow-md");
                              setTimeout(() => matchedSpan.classList.remove("scale-105", "shadow-md"), 1000);
                            }
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`w-3 h-3 rounded-full border ${
                            h.color === "green" ? "bg-emerald-400/30 border-emerald-500"
                            : h.color === "pink" ? "bg-pink-400/30 border-pink-500"
                            : h.color === "blue" ? "bg-sky-400/30 border-sky-500"
                            : "bg-amber-400/30 border-amber-500"
                          }`} />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHighlight(h.id);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                            title="Delete Highlight"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 font-sans italic leading-normal border-l-2 border-slate-200 dark:border-slate-700 pl-2 max-h-16 overflow-hidden text-ellipsis line-clamp-3 select-text select-none">
                          "{h.text}"
                        </div>
                        {h.note && (
                          <div className="mt-1 bg-slate-50 dark:bg-slate-900 p-2 rounded-md border border-slate-100 dark:border-slate-800 text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-400 flex items-start gap-1 select-text">
                            <span className="text-[11px] shrink-0 mt-px select-none">💬</span>
                            <div className="flex-1 font-sans">{h.note}</div>
                          </div>
                        )}
                      </div>
                    ))
                  )
                )}
              </div>
            </aside>

            {/* TOC Toggle */}
            <button
              onClick={() => setTocCollapsed(!tocCollapsed)}
              className="absolute bottom-6 bg-white dark:bg-[#111726] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-500 p-1 rounded-r-lg transition z-20 shadow-sm cursor-pointer flex items-center justify-center h-8 w-6"
              style={{ left: tocCollapsed ? "0px" : "239px" }}
            >
              {tocCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5 transform -rotate-90" />}
            </button>

            {/* ── Content Area ── */}
            <div className="flex-1 bg-[#ebeaeb] dark:bg-[#080b14] p-4 overflow-hidden flex flex-col">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  <span className="text-xs text-slate-400 dark:text-slate-500">Loading notes...</span>
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

                  {/* ── Editor Panel ── */}
                  {(activeTab === "edit" || activeTab === "split") && (
                    <div className="flex-1 flex flex-col bg-white dark:bg-[#111726] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full max-w-4xl">
                      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Edit3 className="h-3 w-3 text-indigo-500" /> Markdown
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{markdown.split("\n").length} lines</span>
                      </div>

                      <textarea
                        ref={textareaRef}
                        value={markdown}
                        onChange={(e) => setMarkdown(e.target.value)}
                        className="flex-1 p-5 w-full resize-none font-mono text-sm leading-relaxed focus:outline-none bg-white dark:bg-[#0c101b] text-slate-800 dark:text-slate-300 overflow-y-auto"
                        placeholder={"# Subject Name\n\n## Topic: Chapter Title\n* **Sources**: Document_Name.pdf\n\nType study notes details here..."}
                      />
                    </div>
                  )}

                  {/* ── Preview Panel ── */}
                  {(activeTab === "preview" || activeTab === "split") && (
                    <div className={`overflow-y-auto h-full px-2 sm:px-8 py-8 ${activeTab === 'preview' ? 'w-full' : 'flex-1'} flex flex-col`}>
                      {renderTTSPlayer()}
                      <div className="flex-1 mt-4">
                        <div id="print-notes-area-wrapper" className="w-full">
                          <div id="print-notes-area">
                            {renderDocumentPreview()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Visual Editor Panel ── */}
                  {activeTab === "visual" && (
                    <div className="overflow-y-auto h-full px-2 sm:px-8 py-8 w-full flex flex-col">
                      {renderTTSPlayer()}
                      <div className="flex-1 mt-4">
                        {renderVisualEditor()}
                      </div>
                    </div>
                  )}

                  {/* ── AI Restructure Side Drawer ── */}
                  {isRestructuring && (
                    <div className="w-96 bg-white dark:bg-[#111726] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full rounded-xl shrink-0 z-10 overflow-hidden animate-slide-in-right">
                      {/* Drawer Header */}
                      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 select-none">
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                          🪄 AI Note Restructurer
                        </span>
                        <button 
                          onClick={() => setIsRestructuring(false)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Drawer Content */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Original Selection */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Original Selection</label>
                          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs leading-relaxed text-slate-650 dark:text-slate-400 italic max-h-36 overflow-y-auto font-sans">
                            "{selectedText}"
                          </div>
                        </div>

                        {/* Formatting Controls */}
                        <div className="space-y-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-950/30 rounded-lg">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Visual Format</label>
                            <select
                              value={restructureStyle}
                              onChange={(e) => setRestructureStyle(e.target.value)}
                              className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 cursor-pointer"
                            >
                              <option value="bullets">📋 High-Yield Bullet List</option>
                              <option value="table">📊 Factual Comparison Table</option>
                              <option value="timeline">⏱️ Chronological Flow / Timeline</option>
                              <option value="mnemonics">⚡ Revision Mnemonics & Key Facts</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custom Instructions</label>
                            <input
                              type="text"
                              value={restructureCustom}
                              onChange={(e) => setRestructureCustom(e.target.value)}
                              placeholder="e.g., make it sound conversational..."
                              className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            />
                          </div>

                          <button
                            onClick={handleRestructureQuery}
                            disabled={generatingRestructure}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-350 dark:disabled:bg-slate-800 text-white text-xs font-bold rounded-lg shrink-0 transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                          >
                            {generatingRestructure ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Restructuring...
                              </>
                            ) : (
                              <>
                                🪄 Generate Restructured Note
                              </>
                            )}
                          </button>
                        </div>

                        {/* Restructured Preview Card */}
                        {(generatingRestructure || restructuredText) && (
                          <div className="space-y-1.5 flex-1 flex flex-col min-h-[220px]">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Restructured AI Output</label>
                            <div className="flex-1 p-3 bg-white dark:bg-[#0c101b] border border-slate-200 dark:border-slate-850 rounded-lg text-xs leading-relaxed text-slate-700 dark:text-slate-300 overflow-y-auto max-h-80 select-text font-mono border-indigo-500/20 shadow-inner">
                              {generatingRestructure ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                                  <span className="text-[10px] font-sans">AI is restructuring note elements...</span>
                                </div>
                              ) : (
                                <div className="space-y-3 font-sans">
                                  {restructuredText.split("\n\n").map((p, idx) => {
                                    if (p.startsWith("|")) {
                                      // Render preview table
                                      return (
                                        <div key={idx} className="overflow-x-auto my-2 border border-slate-100 dark:border-slate-800/80 rounded-md">
                                          <table className="w-full text-left text-[10px] leading-tight">
                                            <tbody>
                                              {p.split("\n").map((row, rIdx) => (
                                                <tr key={rIdx} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                                                  {row.split("|").slice(1, -1).map((cell, cIdx) => (
                                                    <td key={cIdx} className="p-1.5 font-sans font-medium">{cell.trim()}</td>
                                                  ))}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      );
                                    }
                                    if (p.startsWith("#") || p.startsWith("##") || p.startsWith("###")) {
                                      return <h4 key={idx} className="font-bold text-indigo-500 mt-2 text-xs">{p.replace(/#/g, "")}</h4>;
                                    }
                                    if (p.startsWith("-") || p.startsWith("*")) {
                                      return (
                                        <ul key={idx} className="list-disc pl-4 space-y-0.5 font-sans text-xs">
                                          {p.split("\n").map((item, iIdx) => (
                                            <li key={iIdx}>{item.replace(/^[-*]\s+/, "")}</li>
                                          ))}
                                        </ul>
                                      );
                                    }
                                    return <p key={idx} className="font-sans leading-relaxed text-justify">{p}</p>;
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Drawer Footer Actions */}
                      {restructuredText && !generatingRestructure && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex gap-2 shrink-0 select-none">
                          <button
                            onClick={() => {
                              setRestructuredText("");
                              setIsRestructuring(false);
                            }}
                            className="flex-1 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold rounded-lg cursor-pointer transition text-center"
                          >
                            Discard
                          </button>
                          <button
                            onClick={handleApplyRestructure}
                            className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-md flex items-center justify-center gap-1.5 text-center"
                          >
                            Accept &amp; Replace
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
          </main>
        </div>
      </div>

      {/* ── Floating Text Selection Toolbar (Popover) ── */}
      {popoverPosition && selectedText && (
        <div 
          className="absolute z-50 flex items-center gap-1.5 p-1.5 bg-slate-900/95 dark:bg-slate-950/95 text-white rounded-full border border-slate-700 dark:border-slate-800 shadow-2xl backdrop-blur-md transition-all duration-200 select-none -translate-x-1/2"
          style={{ 
            top: `${popoverPosition.top}px`, 
            left: `${popoverPosition.left}px`,
          }}
        >
          {/* Highlight Color Pickers */}
          <div className="flex items-center gap-1.5 px-2 border-r border-slate-700">
            <button 
              onClick={() => handleSaveHighlight("yellow")}
              className="w-4 h-4 rounded-full bg-amber-400 hover:scale-110 active:scale-95 transition cursor-pointer"
              title="Highlight Yellow"
            />
            <button 
              onClick={() => handleSaveHighlight("green")}
              className="w-4 h-4 rounded-full bg-emerald-400 hover:scale-110 active:scale-95 transition cursor-pointer"
              title="Highlight Green"
            />
            <button 
              onClick={() => handleSaveHighlight("pink")}
              className="w-4 h-4 rounded-full bg-pink-400 hover:scale-110 active:scale-95 transition cursor-pointer"
              title="Highlight Pink"
            />
            <button 
              onClick={() => handleSaveHighlight("blue")}
              className="w-4 h-4 rounded-full bg-sky-400 hover:scale-110 active:scale-95 transition cursor-pointer"
              title="Highlight Blue"
            />
          </div>

          {/* Quick Annotation Button */}
          <button 
            onClick={() => setIsAnnotating(true)}
            className="px-2 py-1 hover:bg-slate-800 rounded-full text-[11px] font-bold flex items-center gap-1 text-slate-300 hover:text-white transition cursor-pointer"
            title="Add sticky comment"
          >
            📝 <span className="hidden sm:inline">Comment</span>
          </button>

          {/* Socratic Explanation Button */}
          <button 
            onClick={handleSocraticQuery}
            className="px-2 py-1 hover:bg-slate-800 rounded-full text-[11px] font-bold flex items-center gap-1 text-indigo-300 hover:text-indigo-200 transition cursor-pointer"
            title="Ask Socratic AI to explain this selection"
          >
            💬 <span className="hidden sm:inline">Explain</span>
          </button>

          {/* AI Restructure Button */}
          <button 
            onClick={() => {
              setIsRestructuring(true);
              setRestructuredText("");
            }}
            className="px-2 py-1 hover:bg-slate-800 rounded-full text-[11px] font-bold flex items-center gap-1 text-amber-300 hover:text-amber-200 transition cursor-pointer"
            title="Use AI to restructure selection"
          >
            🪄 <span className="hidden sm:inline">Restructure</span>
          </button>

          {/* Clear Selection */}
          <button 
            onClick={() => {
              setSelectedText("");
              setPopoverPosition(null);
            }}
            className="p-1 hover:bg-rose-500/20 hover:text-rose-400 rounded-full text-slate-400 transition cursor-pointer ml-0.5"
            title="Clear Selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Selection Comment Popup ── */}
      {isAnnotating && (
        <div 
          className="absolute z-50 flex flex-col gap-2.5 p-3 bg-slate-900/95 dark:bg-slate-950/95 border border-slate-700 dark:border-slate-800 text-white rounded-xl shadow-2xl backdrop-blur-md select-none -translate-x-1/2 w-64 animate-fade-in"
          style={{ 
            top: `${popoverPosition ? popoverPosition.top + 45 : 100}px`, 
            left: `${popoverPosition ? popoverPosition.left : 100}px`,
          }}
        >
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">Add Sticky Comment</div>
          <textarea
            value={annotationText}
            onChange={(e) => setAnnotationText(e.target.value)}
            placeholder="Type your personal note comment..."
            className="w-full resize-none h-16 bg-slate-800/80 border border-slate-700 rounded-md p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
          />
          <div className="flex justify-end gap-1.5 select-none">
            <button 
              onClick={() => setIsAnnotating(false)}
              className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button 
              onClick={() => handleSaveHighlight("yellow", annotationText)}
              className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 rounded-md text-white transition cursor-pointer shadow-sm text-center"
            >
              Save Comment
            </button>
          </div>
        </div>
      )}

      {/* ── Socratic Explanation Popup ── */}
      {(loadingSocratic || socraticAnswer) && (
        <div 
          className="absolute z-50 flex flex-col gap-3 p-4 bg-slate-900/95 dark:bg-slate-950/95 border border-indigo-500/35 rounded-xl shadow-2xl backdrop-blur-md -translate-x-1/2 w-[340px] animate-fade-in"
          style={{ 
            top: `${popoverPosition ? popoverPosition.top + 45 : 100}px`, 
            left: `${popoverPosition ? popoverPosition.left : 100}px`,
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-850 pb-1.5 select-none">
            <span className="text-xs font-extrabold text-indigo-400 flex items-center gap-1 font-sans uppercase tracking-wider">
              🎓 Socratic Quick Explain
            </span>
            <button 
              onClick={() => {
                setSocraticAnswer("");
                setLoadingSocratic(false);
              }}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto text-xs text-slate-200 font-sans leading-relaxed select-text pr-1.5 custom-scrollbar">
            {loadingSocratic ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-400 select-none">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                <span className="text-[10px]">Asking Socratic AI to analyze...</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[10px] text-slate-500 italic mb-2 border-l border-slate-700 pl-2 select-none">
                  "{socraticText.substring(0, 80)}..."
                </div>
                <div className="markdown-socratic space-y-3">
                  {socraticAnswer.split("\n\n").map((para, pIdx) => {
                    if (para.startsWith("###") || para.startsWith("##") || para.startsWith("💡") || para.startsWith("🔍") || para.startsWith("🙋")) {
                      return <h4 key={pIdx} className="font-bold text-indigo-300 mt-2 text-xs select-none">{para}</h4>;
                    }
                    if (para.startsWith("-") || para.startsWith("*")) {
                      return (
                        <ul key={pIdx} className="list-disc pl-4 space-y-1 my-1">
                          {para.split("\n").map((line, lIdx) => (
                            <li key={lIdx}>{line.replace(/^[-*]\s+/, "")}</li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={pIdx} className="text-slate-300 leading-relaxed text-justify">{para}</p>;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Focus Mode Overlay ── */}
      {focusMode && (
        <div className="fixed inset-0 z-50 bg-[#ebeaeb] dark:bg-[#080b14] flex flex-col">
          {/* Focus Mode Toolbar (Floating) */}
          <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 flex items-center gap-4 z-50 opacity-10 hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-1">
              <button onClick={() => setFontSize(Math.max(12, fontSize - 2))} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition">
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-sm font-mono w-6 text-center text-slate-600 select-none">{fontSize}</span>
              <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition">
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
            <button 
              onClick={() => setFocusMode(false)}
              className="px-3 py-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white rounded-full text-xs font-bold uppercase tracking-wider transition flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Exit Focus
            </button>
          </div>

          {/* Reading Area */}
          <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-12 w-full flex flex-col items-center">
            {renderTTSPlayer()}
            <div className="flex-1 mt-4 w-full flex justify-center">
              <div id="print-notes-area-wrapper" className="w-full">
                <div id="print-notes-area">
                  {renderDocumentPreview()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ── Unified Export Modal ── */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none p-4">
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl w-full animate-fade-in text-slate-800 dark:text-slate-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Export Subject Binder</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Download subject notes in your preferred format</p>
              </div>
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Format Option Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Markdown Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/20 hover:border-indigo-500 dark:hover:border-indigo-500 transition duration-200 flex flex-col items-center text-center">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-2xl mb-3 shrink-0">
                  <FileText className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Markdown (.md)</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mb-4 flex-1">
                  Perfect for importing notes into Notion, Obsidian, or raw editing.
                </p>
                <button
                  onClick={handleDownloadMarkdown}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Download MD
                </button>
              </div>

              {/* Word DOCX Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/20 hover:border-indigo-500 dark:hover:border-indigo-500 transition duration-200 flex flex-col items-center text-center">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-2xl mb-3 shrink-0">
                  <BookOpen className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Word Document (.docx)</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mb-4 flex-1">
                  Fully styled document that opens cleanly in MS Word, Google Docs, or Pages.
                </p>
                <button
                  onClick={handleDownloadDocx}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Download DOCX
                </button>
              </div>

              {/* PDF Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151c2f]/20 hover:border-indigo-500 dark:hover:border-indigo-500 transition duration-200 flex flex-col items-center text-center">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-2xl mb-3 shrink-0">
                  <Printer className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">High-Fidelity PDF</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mb-4 flex-1">
                  Paginated, ink-efficient print layout. Save as PDF or print directly.
                </p>
                <button
                  onClick={handlePrintPdf}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Print / Save PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
