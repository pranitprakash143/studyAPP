"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import ImageExt from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { useCallback, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered,
  Quote, Code2, Minus, ImageIcon, Video, Link as LinkIcon,
  Palette, Pilcrow,
} from "lucide-react";

export interface TiptapEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  pageWidth?: number;
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
  wordSpacing?: number;
}

function inlineMarkdownToHtml(text: string): string {
  let html = text;
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");
  html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");
  html = html.replace(/==(.*?)==/g, '<mark class="bg-amber-100 dark:bg-amber-500/25 px-1 rounded">$1</mark>');
  return html;
}

function inlineHtmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<del>(.*?)<\/del>/g, "~~$1~~");
  md = md.replace(/<s>(.*?)<\/s>/g, "~~$1~~");
  md = md.replace(/<mark[^>]*>(.*?)<\/mark>/g, "==$1==");
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
}

function markdownToHtml(md: string): string {
  if (!md.trim()) return "<p></p>";
  const sections = md.split("\n\n");
  return sections.map((section) => {
    const t = section.trim();
    if (!t) return "";
    if (t === "---") return "<hr />";
    if (t.startsWith("# Subject:")) return `<h1>${inlineMarkdownToHtml(t.replace("# Subject:", "").trim())}</h1>`;
    if (t.startsWith("# ")) return `<h1>${inlineMarkdownToHtml(t.replace("# ", "").trim())}</h1>`;
    if (t.startsWith("## Topic:")) return `<h2>${inlineMarkdownToHtml(t.replace("## Topic:", "").trim())}</h2>`;
    if (t.startsWith("## ")) return `<h2>${inlineMarkdownToHtml(t.replace("## ", "").trim())}</h2>`;
    if (t.startsWith("### ")) return `<h3>${inlineMarkdownToHtml(t.replace("### ", "").trim())}</h3>`;
    if (t.startsWith("#### ")) return `<h4>${inlineMarkdownToHtml(t.replace("#### ", "").trim())}</h4>`;
    if (t.startsWith("> ")) {
      const content = t.split("\n").map(l => l.replace(/^>\s*/, "")).join(" ");
      return `<blockquote><p>${inlineMarkdownToHtml(content)}</p></blockquote>`;
    }
    if (t.startsWith("```")) {
      const code = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
      return `<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
    }
    const lines = t.split("\n");
    if (lines.every(l => /^[-*•]\s+/.test(l.trim()))) {
      const items = lines.map(l => `<li>${inlineMarkdownToHtml(l.replace(/^[-*•]\s+/, "").trim())}</li>`).join("");
      return `<ul>${items}</ul>`;
    }
    if (lines.every(l => /^\d+\.\s+/.test(l.trim()))) {
      const items = lines.map(l => `<li>${inlineMarkdownToHtml(l.replace(/^\d+\.\s+/, "").trim())}</li>`).join("");
      return `<ol>${items}</ol>`;
    }
    const imgMatch = t.match(/^!\[(.*?)\]\((.+?)\)$/);
    if (imgMatch) return `<img src="${imgMatch[2]}" alt="${imgMatch[1]}" />`;
    const ytMatch = t.match(/^@\[youtube\]\((.+?)\)$/);
    if (ytMatch) {
      return `<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/${ytMatch[1]}" allowfullscreen=""></iframe></div>`;
    }
    return `<p>${inlineMarkdownToHtml(t)}</p>`;
  }).filter(Boolean).join("\n");
}

function htmlToMarkdown(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  const blocks: string[] = [];
  for (const node of div.childNodes) {
    if (node.nodeType === 3) {
      const text = node.textContent?.trim();
      if (text) blocks.push(text);
      continue;
    }
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "hr") { blocks.push("---"); continue; }
    if (tag === "h1") { blocks.push(`# ${inlineHtmlToMarkdown(el.innerHTML)}`); continue; }
    if (tag === "h2") { blocks.push(`## ${inlineHtmlToMarkdown(el.innerHTML)}`); continue; }
    if (tag === "h3") { blocks.push(`### ${inlineHtmlToMarkdown(el.innerHTML)}`); continue; }
    if (tag === "h4") { blocks.push(`#### ${inlineHtmlToMarkdown(el.innerHTML)}`); continue; }
    if (tag === "blockquote") {
      const inner = el.querySelector("p")?.innerHTML || el.innerHTML;
      blocks.push(`> ${inlineHtmlToMarkdown(inner)}`);
      continue;
    }
    if (tag === "pre") {
      const code = el.querySelector("code")?.textContent || el.textContent || "";
      blocks.push("```\n" + code + "\n```");
      continue;
    }
    if (tag === "ul") {
      const items = Array.from(el.querySelectorAll("li")).map(li => `- ${inlineHtmlToMarkdown(li.innerHTML)}`);
      blocks.push(items.join("\n"));
      continue;
    }
    if (tag === "ol") {
      const items = Array.from(el.querySelectorAll("li")).map((li, i) => `${i + 1}. ${inlineHtmlToMarkdown(li.innerHTML)}`);
      blocks.push(items.join("\n"));
      continue;
    }
    if (tag === "img") {
      const src = el.getAttribute("src") || "";
      const alt = el.getAttribute("alt") || "";
      blocks.push(`![${alt}](${src})`);
      continue;
    }
    if (el.hasAttribute("data-youtube-video")) {
      const src = el.querySelector("iframe")?.getAttribute("src") || "";
      const match = src.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (match) { blocks.push(`@[youtube](${match[1]})`); continue; }
    }
    if (tag === "p") { blocks.push(inlineHtmlToMarkdown(el.innerHTML)); continue; }
    if (tag === "br") { blocks.push(""); continue; }
    const text = el.textContent?.trim();
    if (text) blocks.push(text);
  }
  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n");
}

function ToolbarButton({ onClick, active, children, title }: {
  onClick?: () => void; active?: boolean; children: React.ReactNode; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition cursor-pointer ${
        active
          ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
          : "text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-0.5" />;
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const highlightColors = ["#fef08a", "#a7f3d0", "#fecaca", "#bfdbfe"];

  return (
    <div className="flex items-center gap-0.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm overflow-x-auto">
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} title="Paragraph">
        <Pilcrow className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
        <span className="font-bold text-xs">H1</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
        <span className="font-bold text-xs">H2</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
        <span className="font-bold text-xs">H3</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive("heading", { level: 4 })} title="Heading 4">
        <span className="font-bold text-xs">H4</span>
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block">
        <Code2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <div className="relative group">
        <ToolbarButton title="Highlight color">
          <Palette className="h-4 w-4" />
        </ToolbarButton>
        <div className="absolute top-full left-0 mt-1 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg hidden group-hover:flex items-center gap-1 z-50">
          {highlightColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
              className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 cursor-pointer hover:scale-110 transition"
              style={{ backgroundColor: color }}
            />
          ))}
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-0.5" />
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetHighlight().run()}
            className="text-[9px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-1.5 py-0.5 cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      <ToolbarButton
        onClick={() => {
          const url = prompt("Enter URL:") || "";
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        active={editor.isActive("link")}
        title="Insert link"
      >
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => {
          const url = prompt("Paste image URL:") || "";
          const alt = prompt("Image description:") || "image";
          if (url) editor.chain().focus().setImage({ src: url, alt }).run();
        }}
        title="Insert image"
      >
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => {
          const input = prompt("Paste YouTube URL or ID:") || "";
          const match = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)?([a-zA-Z0-9_-]{11})/);
          if (match) {
            const html = `<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/${match[1]}" allowfullscreen=""></iframe></div>`;
            editor.chain().focus().insertContent(html).run();
          }
        }}
        title="Insert YouTube video"
      >
        <Video className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export default function TiptapEditor({
  initialMarkdown, onChange, pageWidth = 816, fontFamily,
  lineHeight, letterSpacing, wordSpacing,
}: TiptapEditorProps) {
  const initializedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      ImageExt.configure({ inline: false, allowBase64: true }),
      LinkExt.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: "Type / for commands, or start writing...",
      }),
      TextStyle,
      Color,
    ],
    content: "",
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const md = htmlToMarkdown(html);
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[600px] px-1",
      },
    },
  });

  useEffect(() => {
    if (editor && !initializedRef.current && initialMarkdown) {
      initializedRef.current = true;
      const html = markdownToHtml(initialMarkdown);
      editor.commands.setContent(html);
    }
  }, [editor, initialMarkdown]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.success && data.url) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } catch {
      console.error("Image upload failed");
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="w-full">
      <div className="mb-4 sticky top-0 z-40">
        <EditorToolbar editor={editor} />
      </div>

      <BubbleMenu editor={editor} pluginKey="bubbleMenu">
        <div className="flex items-center gap-0.5 px-2 py-1.5 rounded-full bg-slate-900 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/50 shadow-2xl">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1 rounded-lg transition cursor-pointer ${editor.isActive("bold") ? "text-white bg-slate-700" : "text-slate-300 hover:text-white"}`}>
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1 rounded-lg transition cursor-pointer ${editor.isActive("italic") ? "text-white bg-slate-700" : "text-slate-300 hover:text-white"}`}>
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1 rounded-lg transition cursor-pointer ${editor.isActive("underline") ? "text-white bg-slate-700" : "text-slate-300 hover:text-white"}`}>
            <UnderlineIcon className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1 rounded-lg transition cursor-pointer ${editor.isActive("strike") ? "text-white bg-slate-700" : "text-slate-300 hover:text-white"}`}>
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-0.5" />
          <button type="button" onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
            className={`p-1 rounded-lg transition cursor-pointer ${editor.isActive("highlight") ? "ring-2 ring-amber-300" : ""}`}>
            <span className="w-3.5 h-3.5 block rounded bg-amber-200" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleHighlight({ color: "#a7f3d0" }).run()}
            className={`p-1 rounded-lg transition cursor-pointer ${editor.isActive("highlight") ? "ring-2 ring-emerald-300" : ""}`}>
            <span className="w-3.5 h-3.5 block rounded bg-emerald-200" />
          </button>
        </div>
      </BubbleMenu>

      <div
        className="w-full mx-auto rounded-2xl border border-slate-200/50 dark:border-slate-800/40 shadow-2xl overflow-hidden transition-all duration-300"
        style={{
          maxWidth: `${pageWidth}px`,
          backgroundColor: "var(--app-card, #ffffff)",
          minHeight: "600px",
          fontFamily: fontFamily || "inherit",
          lineHeight: lineHeight || 1.8,
          letterSpacing: letterSpacing != null ? `${letterSpacing}em` : "0.008em",
          wordSpacing: wordSpacing != null ? `${wordSpacing}em` : "0.04em",
        }}
      >
        <div className="px-12 py-14 sm:px-20 sm:py-18">
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            className="hidden"
            id="tiptap-image-upload"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = "";
            }}
          />
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
