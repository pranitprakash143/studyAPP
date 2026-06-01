export interface SubSectionNode {
  name: string;
  fullName: string;
}

export interface TopicNode {
  name: string;
  fullName: string;
  sources: string[];
  subsections: SubSectionNode[];
}

export type ViewMode = "preview" | "split" | "visual" | "mindmap";
export type SidebarTab = "chapters" | "highlights";
export type CleanStyle = "bullets" | "summary" | "table" | "timeline";
export type HighlightColor = "yellow" | "green" | "pink" | "blue";
export type HeadingLevel = 1 | 2 | 3 | 4;

export interface Highlight {
  id: string;
  subject: string;
  topic: string;
  text: string;
  color: HighlightColor;
  note?: string;
  createdAt: string;
}

export interface MindmapNode {
  id: string;
  label: string;
}

export interface MindmapEdge {
  source: string;
  target: string;
  label?: string;
}

export interface MindmapGraph {
  nodes: MindmapNode[];
  links: MindmapEdge[];
}

export interface CleanChapterContext {
  targetChapter: string;
  beforeText: string;
  afterText: string;
  chapterHeader: string;
  hasSources: boolean;
  sourcesLine: string;
}

export interface ParsedBlock {
  type: "heading" | "paragraph" | "list" | "table" | "blockquote" | "image" | "youtube" | "divider" | "source";
  content: string;
  lines: string[];
  meta?: Record<string, unknown>;
}

export interface ChapterGroup {
  title: string;
  fullName: string;
  blocks: ParsedBlock[];
}

export interface TOCChapter {
  name: string;
  fullName: string;
  sources: string[];
  subsections: SubSectionNode[];
}
