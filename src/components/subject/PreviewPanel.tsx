"use client";

import React from "react";
import { BookOpen, Volume2 } from "lucide-react";
import CalligraphyHeroBanner from "./CalligraphyHeroBanner";
import type { TopicNode } from "@/lib/subject/types";

interface PreviewPanelProps {
  previewContainerRef: React.RefObject<HTMLDivElement | null>;
  handleTextSelection: () => void;
  pageWidth: number;
  isDark: boolean;
  activeFont: string;
  getFontFamily: (font: string) => string;
  markdown: string;
  cleanAiMarkdownArtifacts: (md: string) => string;
  topics: TopicNode[];
  subject: string;
  activeChapterFilter: string;
  parsedTOC: { name: string; fullName: string; sources: string[]; subsections: { name: string; fullName: string }[] }[];
  formatDisplayName: (name: string) => string;
  highlights: any[];
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  currentBlockIndex: number;
  speakBlock: (index: number) => void;
}

export default function PreviewPanel({
  previewContainerRef,
  handleTextSelection,
  pageWidth,
  isDark,
  activeFont,
  getFontFamily,
  markdown,
  cleanAiMarkdownArtifacts,
  topics,
  subject,
  activeChapterFilter,
  parsedTOC,
  formatDisplayName,
  highlights,
  fontSize,
  lineHeight,
  letterSpacing,
  wordSpacing,
  currentBlockIndex,
  speakBlock,
}: PreviewPanelProps) {
  const renderMarkdownContent = (text: string) => {
    const normalizedText = text.replace(/\n\s*---\s*\n/g, "\n---\n");
    const blocks = normalizedText.split("\n\n");

    const textStyle: React.CSSProperties = {
      color: isDark ? '#d6d0c8' : '#2d2a24',
      lineHeight: lineHeight,
      wordSpacing: `${wordSpacing}em`,
      letterSpacing: `${letterSpacing}em`,
    };

    const sortedHighlights = [...highlights].sort((a, b) => b.text.length - a.text.length);

    const getHighlightColorClass = (color: string) => {
      switch (color) {
        case "green":
          return isDark
            ? "bg-emerald-500/20 text-emerald-100"
            : "bg-emerald-100/70 text-emerald-900";
        case "pink":
          return isDark
            ? "bg-pink-500/20 text-pink-100"
            : "bg-pink-100/70 text-pink-900";
        case "blue":
          return isDark
            ? "bg-sky-500/20 text-sky-100"
            : "bg-sky-100/70 text-sky-900";
        case "yellow":
        default:
          return isDark
            ? "bg-amber-500/20 text-amber-100"
            : "bg-amber-100/70 text-amber-900";
      }
    };

    const applyHighlights = (node: React.ReactNode, keyPrefix: string): React.ReactNode => {
      if (typeof node !== "string") {
        if (Array.isArray(node)) {
          return node.map((child, idx) => applyHighlights(child, `${keyPrefix}-${idx}`));
        }
        if (node && React.isValidElement(node)) {
          const children = (node.props as any).children;
          if (children) {
            return React.cloneElement(node, { key: keyPrefix } as any, applyHighlights(children, `${keyPrefix}-child`));
          }
          return node;
        }
        return node;
      }

      const text = node;
      if (!text.trim()) return text;

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
          className={`inline relative rounded transition duration-150 cursor-pointer ${colorClass}`}
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

    const renderInlineFormatting = (content: string, keyPrefix: string) => {
      if (!content) return [];

      const mediaRegex = /(!\[.*?\]\(.+?\))|(@\[youtube\]\(.+?\))|(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11})/g;
      const segments: React.ReactNode[] = [];
      let lastIdx = 0;
      let match: RegExpExecArray | null;
      let segKey = 0;
      while ((match = mediaRegex.exec(content)) !== null) {
        if (match.index > lastIdx) {
          segments.push(content.slice(lastIdx, match.index));
        }
        const full = match[0];
        if (full.startsWith("![")) {
          const img = full.match(/^!\[(.*?)\]\((.+?)\)$/);
          if (img) {
            segments.push(
              <img key={`${keyPrefix}-img-${segKey++}`} src={img[2]} alt={img[1]} className="inline-block max-w-full h-auto rounded-lg shadow-md my-2" loading="lazy" />
            );
          }
        } else {
          const vid = full.match(/([a-zA-Z0-9_-]{11})/)?.[1] || "";
          segments.push(
            <span key={`${keyPrefix}-yt-${segKey++}`} className="inline-block my-2 w-full max-w-lg aspect-video rounded-lg overflow-hidden shadow-md" style={{ display: 'inline-block' }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${vid}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube embed"
              />
            </span>
          );
        }
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < content.length) {
        segments.push(content.slice(lastIdx));
      }

      return segments.flatMap((seg, sIdx) => {
        if (typeof seg !== "string") return [seg];
        const boldParts = (seg as string).split("**");
        return boldParts.flatMap((bPart, bIdx) => {
          const isBold = bIdx % 2 === 1;
          const italicRegex = /\*(.+?)\*/g;
          const renderedItalicParts: React.ReactNode[] = [];
          let lastIdx = 0;
          let m: RegExpExecArray | null;
          while ((m = italicRegex.exec(bPart)) !== null) {
            if (m.index > lastIdx) {
              renderedItalicParts.push(bPart.slice(lastIdx, m.index));
            }
            renderedItalicParts.push(
              <em key={`${keyPrefix}-it-${sIdx}-${bIdx}-${renderedItalicParts.length}`} className="italic">{m[1]}</em>
            );
            lastIdx = m.index + m[0].length;
          }
          if (lastIdx < bPart.length) {
            renderedItalicParts.push(bPart.slice(lastIdx));
          }
          if (isBold) {
            return (
              <strong key={`${keyPrefix}-b-${sIdx}-${bIdx}`} className="font-bold text-slate-900 dark:text-stone-100">
                {renderedItalicParts}
              </strong>
            );
          }
          return renderedItalicParts;
        });
      });
    };

    const parseListItem = (line: string, keyPrefix: string) => {
      const cleanLine = line.replace(/^[-*•]\s+/, "").trim();
      return renderInlineFormatting(cleanLine, keyPrefix);
    };

    interface ChapterGroup {
      title: string;
      fullName: string;
      elements: React.JSX.Element[];
    }

    const chapterGroups: ChapterGroup[] = [];
    let currentGroup: ChapterGroup = {
      title: "Introduction",
      fullName: "Introduction",
      elements: []
    };

    let blockKey = 0;

    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b].trim();
      if (!block) continue;
      blockKey++;

      const lines = block.split("\n");
      const firstLine = lines[0].trim();

      const isNewChapter = firstLine.startsWith("# ") && !firstLine.startsWith("# Subject:");
      const isLegacyChapter = firstLine.startsWith("## Topic:");
      if (isNewChapter || isLegacyChapter) {
        const heading = isLegacyChapter
          ? firstLine.replace("## Topic:", "").trim()
          : firstLine.replace("# ", "").trim();
        const displayHeading = heading.replace(/^Topic:\s*/i, "").trim();

        if (currentGroup.elements.length > 0 || currentGroup.title !== "Introduction") {
          chapterGroups.push(currentGroup);
        }

        currentGroup = {
          title: displayHeading,
          fullName: heading,
          elements: []
        };
        continue;
      }

      if (block === "---") {
        currentGroup.elements.push(
          <div key={`div-${blockKey}`} className="my-10 flex justify-center text-slate-300 dark:text-slate-700 tracking-[1em] select-none">
            🜂 🜃 🜁
          </div>
        );
        continue;
      }

      if (block.startsWith("|")) {
        const rows = block.split("\n").map(r => r.trim()).filter(r => r.startsWith("|"));
        if (rows.length >= 2) {
          const parsedRows = rows.map(r => r.split("|").slice(1, -1).map(cell => cell.trim()));
          const headers = parsedRows[0];
          const hasSeparator = rows[1].includes("-");
          const bodyRows = hasSeparator ? parsedRows.slice(2) : parsedRows.slice(1);

          currentGroup.elements.push(
            <div key={`table-wrapper-${blockKey}`} className="group flex items-start gap-2 w-full relative justify-between">
              <div
                className={`my-6 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50 flex-1 transition-all duration-300 ${currentBlockIndex === b ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 p-2 -mx-2 shadow-sm" : ""}`}
              >
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                      {headers.map((h, idx) => (
                        <th key={`th-${idx}`} className="px-4 py-3 font-bold text-slate-900 dark:text-white" style={{ fontFamily: '"Book Antiqua", serif', ...textStyle }}>
                          {applyHighlights(renderInlineFormatting(h, `th-${blockKey}-${idx}`), `th-${blockKey}-${idx}-hl`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bodyRows.map((row, rIdx) => (
                      <tr key={`tr-${rIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        {row.map((cell, cIdx) => (
                          <td key={`td-${cIdx}`} className="px-4 py-3 text-slate-700 dark:text-slate-300" style={textStyle}>
                            {applyHighlights(renderInlineFormatting(cell, `td-${blockKey}-${rIdx}-${cIdx}`), `td-${blockKey}-${rIdx}-${cIdx}-hl`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); speakBlock(b); }}
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

      const isListBlock = lines.every(l => l.trim().startsWith("- ") || l.trim().startsWith("* ") || l.trim().startsWith("• "));

      if (isListBlock) {
        currentGroup.elements.push(
          <div key={`ul-wrapper-${blockKey}`} className="group flex items-start gap-2 w-full relative justify-between">
            <ul
              className={`ml-6 list-disc space-y-1.5 my-5 flex-1 transition-all duration-300 ${currentBlockIndex === b ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 rounded p-2 -mx-2 shadow-sm" : ""}`}
              style={textStyle}
            >
              {lines.map((l, lIdx) => (
                <li key={lIdx} className="pl-1" style={{ ...textStyle, fontSize: `${fontSize}px` }}>
                  {applyHighlights(parseListItem(l, `li-${blockKey}-${lIdx}`), `li-${blockKey}-${lIdx}-hl`)}
                </li>
              ))}
            </ul>
            <button
              onClick={(e) => { e.stopPropagation(); speakBlock(b); }}
              className="mt-5 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
              title="Read list block"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
        continue;
      }

      if (firstLine.startsWith("# Subject:")) {
        continue;
      }

      const isNewSubheading = firstLine.startsWith("## ") && !firstLine.startsWith("## Topic:");
      const isLegacySubheading = firstLine.startsWith("### ");
      if (isNewSubheading || isLegacySubheading) {
        const subText = isLegacySubheading
          ? firstLine.replace("### ", "").trim()
          : firstLine.replace("## ", "").trim();
        currentGroup.elements.push(
          <div key={`sub-wrapper-${blockKey}`} className="group flex items-center justify-between gap-3 mt-10 mb-4 w-full relative">
            {isLegacySubheading ? (
              <h3
                data-topic-id={encodeURIComponent(subText)}
                className={`font-semibold text-slate-900 dark:text-slate-100 transition-all duration-300 flex-1 ${currentBlockIndex === b ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 rounded px-2 shadow-sm" : ""}`}
                style={{ ...textStyle, fontSize: `${fontSize * 1.2}px` }}
              >
                {applyHighlights(subText, `sub-${blockKey}-hl`)}
              </h3>
            ) : (
              <h2
                data-topic-id={encodeURIComponent(subText)}
                className={`font-semibold text-slate-900 dark:text-slate-100 transition-all duration-300 flex-1 ${currentBlockIndex === b ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 rounded px-2 shadow-sm" : ""}`}
                style={{ ...textStyle, fontSize: `${fontSize * 1.35}px` }}
              >
                {applyHighlights(subText, `sub-${blockKey}-hl`)}
              </h2>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); speakBlock(b); }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
              title="Read subheading"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
        const remainingLines = lines.slice(1).filter(l => l.trim());
        if (remainingLines.length > 0) {
          const bodyContent = remainingLines.join("\n");
          currentGroup.elements.push(
            <div key={`p-after-sub-${blockKey}`} className="group flex items-start gap-2 w-full relative justify-between">
              <p className="my-3 leading-relaxed flex-1" style={{ ...textStyle, fontSize: `${fontSize}px` }}>
                {applyHighlights(renderInlineFormatting(bodyContent, `p-sub-${blockKey}`), `p-sub-${blockKey}-hl`)}
              </p>
            </div>
          );
        }
        continue;
      }

      if (firstLine.startsWith("* **Sources**:")) {
        continue;
      }

      if (firstLine.startsWith("> ")) {
        const quoteContent = lines.map(l => l.replace(/^>\s?/, "").trim()).join("\n");
        currentGroup.elements.push(
          <div key={`quote-wrapper-${blockKey}`} className="group flex items-start gap-2 w-full relative justify-between">
            <blockquote
              className={`ml-2 mr-2 my-5 pl-5 border-l-4 border-amber-500 bg-amber-50/40 dark:bg-amber-950/10 py-3 pr-4 rounded-r-lg text-slate-800 dark:text-slate-200 italic flex-1 transition-all duration-300 ${currentBlockIndex === b ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 p-2 -mx-2 shadow-sm" : ""}`}
              style={{ ...textStyle, fontSize: `${fontSize}px` }}
            >
              {applyHighlights(renderInlineFormatting(quoteContent, `q-${blockKey}`), `q-${blockKey}-hl`)}
            </blockquote>
            <button
              onClick={(e) => { e.stopPropagation(); speakBlock(b); }}
              className="mt-8 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
              title="Read blockquote"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
        continue;
      }

      const imgMatch = block.match(/^!\[(.*?)\]\((.+?)\)$/);
      if (imgMatch) {
        currentGroup.elements.push(
          <div key={`img-${blockKey}`} className="my-6 flex justify-center">
            <img src={imgMatch[2]} alt={imgMatch[1]} className="max-w-full h-auto rounded-xl shadow-lg" loading="lazy" />
          </div>
        );
        continue;
      }

      const youtubeMatch = block.match(/^@\[youtube\]\((.+?)\)$/) || block.match(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (youtubeMatch) {
        const vid = youtubeMatch[1];
        currentGroup.elements.push(
          <div key={`yt-${blockKey}`} className="my-6 flex justify-center">
            <div className="relative w-full max-w-2xl aspect-video rounded-xl overflow-hidden shadow-lg">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${vid}`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube embed"
              />
            </div>
          </div>
        );
        continue;
      }

      currentGroup.elements.push(
        <div key={`p-wrapper-${blockKey}`} className="group flex items-start gap-2 w-full relative justify-between">
          <p
            className={`my-5 leading-relaxed flex-1 transition-all duration-300 ${currentBlockIndex === b ? "ring-2 ring-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20 rounded px-2 -mx-2 shadow-sm" : ""}`}
            style={{ ...textStyle, fontSize: `${fontSize}px` }}
          >
            {applyHighlights(renderInlineFormatting(block, `p-${blockKey}`), `p-${blockKey}-hl`)}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); speakBlock(b); }}
            className="mt-5 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition cursor-pointer select-none shrink-0"
            title="Read paragraph"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }

    if (currentGroup.elements.length > 0 || currentGroup.title !== "Introduction") {
      chapterGroups.push(currentGroup);
    }

    const renderChapterSeparator = (title: string, index: number) => {
      return (
        <div
          key={`chapter-sep-${index}`}
          className="relative my-16 py-8 px-6 text-center select-none animate-fade-in group w-full overflow-hidden border-y border-dashed border-[#c5a880]/30"
          style={{
            background: isDark
              ? "linear-gradient(90deg, transparent 0%, rgba(37, 31, 24, 0.45) 20%, rgba(37, 31, 24, 0.45) 80%, transparent 100%)"
              : "linear-gradient(90deg, transparent 0%, rgba(253, 247, 238, 0.7) 20%, rgba(253, 247, 238, 0.7) 80%, transparent 100%)",
          }}
        >
          <div className="flex items-center justify-center gap-3 w-full opacity-70 mb-3.5 select-none">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#d4af37]/60" />
            <span className="text-[#d4af37] text-base animate-pulse shrink-0">🪷</span>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#d4af37]/60" />
          </div>
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-[#d97706] to-[#b91c1c] text-white shadow-md shadow-[#d97706]/10 select-none">
            <span>VOLUME {index}</span>
          </div>
          <h2
            data-topic-id={encodeURIComponent(title)}
            className="text-xl md:text-2xl font-extrabold tracking-wide text-slate-800 dark:text-stone-100 leading-tight mt-2.5 mx-auto max-w-lg"
            style={{
              fontFamily: '"EB Garamond", Georgia, serif',
              textShadow: isDark ? '0 1px 4px rgba(0,0,0,0.4)' : 'none'
            }}
          >
            {applyHighlights(title, `h2-ch-${index}`)}
          </h2>
        </div>
      );
    };

    const finalElements: React.JSX.Element[] = [];

    if (activeChapterFilter === "All") {
      let chapterVolume = 0;
      chapterGroups.forEach((group, index) => {
        if (index > 0) {
          chapterVolume++;
          finalElements.push(renderChapterSeparator(group.title, chapterVolume));
        }
        finalElements.push(...group.elements);
      });
    } else {
      const matchedIdx = chapterGroups.findIndex(g => g.title === activeChapterFilter);
      if (matchedIdx !== -1) {
        finalElements.push(...chapterGroups[matchedIdx].elements);
      }
    }

    return finalElements;
  };

  const selectedFontFamily = getFontFamily(activeFont);

  return (
    <div
      ref={previewContainerRef}
      onMouseUp={handleTextSelection}
      className="w-full shadow-2xl rounded-2xl mx-auto border border-slate-200/50 dark:border-slate-800/40 transition-all duration-300 relative overflow-hidden flex flex-col"
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
      <CalligraphyHeroBanner
        subject={subject}
        activeChapterFilter={activeChapterFilter}
        parsedTOC={parsedTOC}
        isDark={isDark}
        formatDisplayName={formatDisplayName}
      />

      <div className="px-10 py-10 sm:px-16 sm:py-12 flex-1 flex flex-col">
        <div className="flex-1 flex flex-col max-w-none break-words">
          {markdown.trim() ? (
            renderMarkdownContent(cleanAiMarkdownArtifacts(markdown))
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

        <div className="border-t border-slate-200/80 pt-6 mt-16 flex justify-between text-[11px] text-slate-400 select-none font-medium" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <span>PrepAgent System</span>
          <span>{topics.length} organized chapters</span>
        </div>
      </div>
    </div>
  );
}
