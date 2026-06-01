import type { TOCChapter, TopicNode } from "./types";

export function parseTOC(markdown: string): TOCChapter[] {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const chapters: TOCChapter[] = [];
  let current: TOCChapter | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if ((line.startsWith("# ") && !line.startsWith("# Subject:")) || line.startsWith("## Topic:")) {
      const fullName = line.startsWith("## Topic:") ? line.substring(9).trim() : line.substring(2).trim();
      const cleanName = fullName.replace(/^Topic:\s*/i, "").trim();
      current = { name: cleanName, fullName, sources: [], subsections: [] };
      chapters.push(current);
      continue;
    }
    if (current && line.startsWith("* **Sources**:")) {
      const src = line.replace("* **Sources**:", "").trim();
      if (src) current.sources = src.split(",").map(s => s.trim()).filter(Boolean);
      continue;
    }
    if (current && ((line.startsWith("## ") && !line.startsWith("## Topic:")) || line.startsWith("### "))) {
      const fullName = line.startsWith("### ") ? line.substring(4).trim() : line.substring(3).trim();
      const cleanName = fullName.replace(/^Topic:\s*/i, "").trim();
      current.subsections.push({ name: cleanName, fullName });
    }
  }
  return chapters;
}

export function parseTopics(markdown: string): TopicNode[] {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const topics: TopicNode[] = [];
  let current: TopicNode | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const isNewChapter = trimmed.startsWith("# ") && !trimmed.startsWith("# Subject:");
    const isLegacyChapter = trimmed.startsWith("## Topic:");
    if (isNewChapter || isLegacyChapter) {
      if (current) topics.push(current);
      const headerText = isLegacyChapter ? trimmed.substring(9).trim() : trimmed.substring(2).trim();
      const rawTopic = headerText.replace(/^Topic:\s*/i, "").trim();
      const cleanedTopic = rawTopic.includes(" - ") ? rawTopic.split(" - ").slice(1).join(" - ").trim() : rawTopic;
      current = { name: cleanedTopic, fullName: rawTopic, sources: [], subsections: [] };
    } else if ((trimmed.startsWith("## ") && !trimmed.startsWith("## Topic:")) || trimmed.startsWith("### ")) {
      if (current) {
        const subName = trimmed.startsWith("### ") ? trimmed.substring(4).trim() : trimmed.substring(3).trim();
        current.subsections.push({ name: subName, fullName: subName });
      }
    } else if (trimmed.startsWith("* **Sources**:") && current) {
      const match = trimmed.match(/\* \*\*Sources\*\*:\s*(.*)/);
      if (match?.[1]) current.sources = match[1].split(",").map(s => s.trim());
    }
  }
  if (current) topics.push(current);
  return topics;
}
