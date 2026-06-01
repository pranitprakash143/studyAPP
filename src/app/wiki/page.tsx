"use client";

/**
 * src/app/wiki/page.tsx
 *
 * Wiki Explorer — visualizes the LLM Wiki compiled knowledge graph.
 *
 * Features:
 * - Interactive force-directed knowledge graph (nodes = wiki pages, edges = connections)
 * - Left panel: searchable, filterable wiki page list by subject
 * - Right panel: rendered wiki page content with Markdown display
 * - Cross-link navigation: click [[Related Topic]] links to jump between pages
 * - Subject color coding on graph nodes
 * - Empty state when no pages compiled yet
 */

import { useEffect, useState, useCallback, useRef } from "react";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import {
  Network,
  Search,
  BookOpen,
  Tag,
  Link2,
  FileText,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Clock,
  Layers,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WikiPage {
  id: string;
  title: string;
  subject: string;
  slug: string;
  tags: string[];
  sources: string[];
  last_compiled: string;
}

interface WikiPageDetail extends WikiPage {
  body: string;
  related: string[];
  raw: string;
}

interface GraphNode {
  id: string;
  label: string;
  subject: string;
  tags: string[];
}

interface GraphEdge {
  from: string;
  to: string;
  from_title: string;
  to_title: string;
  label: string;
}

interface WikiGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  node_count: number;
  edge_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject color map (matches PrepAgent subject taxonomy)
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, string> = {
  History: "#6366f1",
  Geography: "#10b981",
  Polity: "#f59e0b",
  Economics: "#ef4444",
  Environment: "#22c55e",
  "Current Affairs": "#3b82f6",
  "Science & Tech": "#8b5cf6",
  Assam: "#ec4899",
  Miscellaneous: "#64748b",
  Extra: "#94a3b8",
};

function subjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] || "#6366f1";
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple Markdown renderer (handles headers, bold, bullets, blockquotes, [[links]])
// ─────────────────────────────────────────────────────────────────────────────

function renderMarkdown(
  text: string,
  onLinkClick: (title: string) => void
): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  const processInline = (line: string, key: string): React.ReactNode => {
    // Process [[wiki links]], **bold**, and plain text
    const parts = line.split(/(\[\[.+?\]\]|\*\*.+?\*\*)/g);
    return (
      <span key={key}>
        {parts.map((part, pi) => {
          const wikiMatch = part.match(/^\[\[(.+?)\]\]$/);
          if (wikiMatch) {
            return (
              <button
                key={pi}
                onClick={() => onLinkClick(wikiMatch[1])}
                className="text-indigo-500 hover:text-indigo-400 underline underline-offset-2 font-medium transition-colors cursor-pointer"
              >
                {wikiMatch[1]}
              </button>
            );
          }
          const boldMatch = part.match(/^\*\*(.+?)\*\*$/);
          if (boldMatch) {
            return (
              <strong key={pi} className="font-semibold text-slate-100">
                {boldMatch[1]}
              </strong>
            );
          }
          return <span key={pi}>{part}</span>;
        })}
      </span>
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-lg font-bold text-slate-100 mt-6 mb-3 pb-2 border-b border-slate-700/60 flex items-center gap-2"
        >
          <span className="w-1 h-5 rounded-full bg-indigo-500 inline-block" />
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={i}
          className="text-xl font-bold text-slate-100 mt-2 mb-4"
        >
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="border-l-4 border-indigo-500/60 pl-4 py-1 my-2 bg-indigo-950/30 rounded-r-lg text-slate-300 text-sm italic"
        >
          {processInline(line.slice(2), `bq-${i}`)}
        </blockquote>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <li
          key={i}
          className="flex items-start gap-2 text-sm text-slate-300 my-1 ml-2"
        >
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
          {processInline(line.slice(2), `li-${i}`)}
        </li>
      );
    } else if (line.trim() === "---") {
      elements.push(
        <hr key={i} className="my-4 border-slate-700/60" />
      );
    } else if (line.trim()) {
      elements.push(
        <p key={i} className="text-sm text-slate-400 my-1.5 leading-relaxed">
          {processInline(line, `p-${i}`)}
        </p>
      );
    }

    i++;
  }

  return elements;
}


import ReactFlowGraph from "@/components/ReactFlowGraph";
import GraphErrorBoundary from "@/components/GraphErrorBoundary";


// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function WikiPage() {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [graph, setGraph] = useState<WikiGraph | null>(null);
  const [selectedPage, setSelectedPage] = useState<WikiPageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [view, setView] = useState<"list" | "graph">("list");
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();

  // Load wiki pages + graph
  const loadWiki = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pagesRes, graphRes] = await Promise.all([
        fetch("/api/wiki"),
        fetch("/api/wiki/graph"),
      ]);
      const pagesData = await pagesRes.json();
      const graphData = await graphRes.json();

      if (pagesData.error) throw new Error(pagesData.error);
      if (graphData.error) throw new Error(graphData.error);

      setPages(pagesData.pages || []);
      setGraph(graphData);
    } catch (e: any) {
      setError(e.message || "Failed to load wiki");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWiki();
  }, [loadWiki]);

  // Load a specific wiki page
  const loadPage = useCallback(async (subject: string, slug: string, nodeId?: string) => {
    setPageLoading(true);
    try {
      const res = await fetch(`/api/wiki/${subject}/${slug}`);
      if (!res.ok) throw new Error(`Page not found: ${subject}/${slug}`);
      const data: WikiPageDetail = await res.json();
      setSelectedPage(data);
      if (nodeId) setSelectedNodeId(nodeId);
    } catch (e: any) {
      console.error("Failed to load wiki page:", e);
    } finally {
      setPageLoading(false);
    }
  }, []);

  // Handle clicking a [[wiki link]] in the body
  const handleWikiLinkClick = useCallback(
    (title: string) => {
      // Find the page by title
      const page = pages.find(
        (p) => p.title.toLowerCase() === title.toLowerCase()
      );
      if (page) {
        loadPage(page.subject, page.slug, page.id);
      }
    },
    [pages, loadPage]
  );

  // Handle graph node click
  const handleNodeClick = useCallback(
    (node: any) => {
      const parts = node.id.split("/");
      if (parts.length === 2) {
        loadPage(parts[0], parts[1], node.id);
      }
    },
    [loadPage]
  );

  // Derived state
  const subjects = ["All", ...Array.from(new Set(pages.map((p) => p.subject))).sort()];
  const filteredPages = pages.filter((p) => {
    const matchSubject = subjectFilter === "All" || p.subject === subjectFilter;
    const matchSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchSubject && matchSearch;
  });

  const formatDate = (iso: string) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#0e1322] overflow-hidden">
      {/* ── Left Panel: Pages List ────────────────────────────────────────── */}
      <aside className="w-80 shrink-0 border-r border-slate-800 flex flex-col bg-[#111827]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10">
                <Network className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-100">Wiki Explorer</h1>
                <p className="text-xs text-slate-500">{pages.length} compiled pages</p>
              </div>
            </div>
            <button
              onClick={loadWiki}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search pages or tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700 mb-3">
            {(["list", "graph"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex-1 py-1.5 text-xs font-medium capitalize transition cursor-pointer ${
                  view === v
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {v === "list" ? "📋 List" : "🕸 Graph"}
              </button>
            ))}
          </div>

          {/* Subject filter */}
          <div className="flex flex-wrap gap-1">
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => setSubjectFilter(s)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition cursor-pointer ${
                  subjectFilter === s
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
                style={
                  subjectFilter === s && s !== "All"
                    ? { backgroundColor: subjectColor(s) }
                    : {}
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Pages list */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingState message="Loading wiki pages..." size="sm" />
            </div>
          ) : error ? (
            <div className="p-4 flex items-start gap-2 text-red-400 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <EmptyState
                icon={<FileText className="h-8 w-8 text-indigo-400" />}
                title={pages.length === 0 ? "No wiki pages yet" : "No pages match"}
                description={pages.length === 0 ? "Upload study materials to auto-compile wiki pages" : "Try a different search or subject filter"}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-2">
              {filteredPages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => loadPage(page.subject, page.slug, page.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800/60 transition cursor-pointer ${
                    selectedPage?.title === page.title
                      ? "bg-indigo-950/40 border-l-2 border-l-indigo-500"
                      : "hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-200 leading-tight line-clamp-2">
                      {page.title}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: subjectColor(page.subject) }}
                    >
                      {page.subject}
                    </span>
                    {page.last_compiled && (
                      <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDate(page.last_compiled)}
                      </span>
                    )}
                  </div>
                  {page.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {page.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Right Panel: Page Content ────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {selectedPage ? (
          <>
            {/* Page header */}
            <div className="px-8 py-5 border-b border-slate-800 bg-[#111827]/60 backdrop-blur-sm shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: subjectColor(selectedPage.subject) }}
                    >
                      {selectedPage.subject}
                    </span>
                    {selectedPage.last_compiled && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Compiled {formatDate(selectedPage.last_compiled)}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-slate-100 leading-tight">
                    {selectedPage.title}
                  </h1>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedPage.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full flex items-center gap-1"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPage(null)}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer shrink-0"
                  title="Close page"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>

              {/* Related pages */}
              {selectedPage.related && selectedPage.related.length > 0 && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Related:
                  </span>
                  {selectedPage.related.map((rel) => (
                    <button
                      key={rel}
                      onClick={() => handleWikiLinkClick(rel)}
                      className="text-xs px-2.5 py-1 rounded-full bg-indigo-950/50 text-indigo-400 hover:bg-indigo-900/60 hover:text-indigo-300 border border-indigo-800/50 transition cursor-pointer"
                    >
                      {rel}
                    </button>
                  ))}
                </div>
              )}

              {/* Sources */}
              {selectedPage.sources && selectedPage.sources.length > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Sources:
                  </span>
                  {selectedPage.sources.map((src) => (
                    <span
                      key={src}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Page body */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {pageLoading ? (
                <div className="flex items-center justify-center py-20">
                  <LoadingState message="Loading page..." size="sm" />
                </div>
              ) : (
                <article className="max-w-3xl">
                  {renderMarkdown(selectedPage.body, handleWikiLinkClick)}
                </article>
              )}
            </div>
          </>
        ) : view === "graph" && graph ? (
          /* Graph view taking up full right panel */
          <div className="flex-1 relative bg-[#0a0f1c]">
            <GraphErrorBoundary>
              <ReactFlowGraph
                nodes={graph.nodes}
                edges={graph.edges}
                selectedId={selectedNodeId}
                onNodeClick={handleNodeClick}
                subjectColor={subjectColor}
              />
            </GraphErrorBoundary>
            <div className="absolute bottom-6 left-6 flex gap-4 text-xs font-semibold text-slate-400 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700/50 backdrop-blur-md shadow-lg shadow-black/50 z-10">
              <span className="flex items-center gap-1.5"><FileText className="h-4 w-4 text-indigo-400" /> {graph.node_count} Pages</span>
              <span className="w-px bg-slate-700"></span>
              <span className="flex items-center gap-1.5"><Link2 className="h-4 w-4 text-emerald-400" /> {graph.edge_count} Connections</span>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#0a0f1c]">
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-2xl scale-150" />
              <div className="relative p-8 rounded-3xl bg-gradient-to-br from-indigo-950/80 to-slate-900 border border-indigo-800/30">
                <Network className="h-16 w-16 text-indigo-400 mx-auto" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-100 mb-3">
              Wiki Knowledge Explorer
            </h2>
            <p className="text-slate-400 max-w-md leading-relaxed mb-2">
              Select a page from the left panel to read it, or switch to{" "}
              <button onClick={() => setView("graph")} className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">Graph view</button> to explore
              connections between topics visually.
            </p>
            <p className="text-xs text-slate-600 max-w-sm">
              Wiki pages are automatically compiled and cross-linked after each
              document ingestion — inspired by Karpathy&apos;s LLM Wiki pattern.
            </p>

            {pages.length > 0 && (
              <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg w-full">
                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-2xl font-bold text-indigo-400">{pages.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Wiki Pages</p>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-2xl font-bold text-emerald-400">
                    {graph?.edge_count ?? 0}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Connections</p>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-2xl font-bold text-amber-400">
                    {new Set(pages.map((p) => p.subject)).size}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Subjects</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
