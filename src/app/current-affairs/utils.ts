export interface NewsItem {
  headline: string;
  summary: string;
  examRelevance: string;
  source: string;
  category: string;
  imageUrl?: string;
}

export interface NewsDigest {
  india: NewsItem[];
  assam: NewsItem[];
  world: NewsItem[];
}

export const categoryColors: Record<string, string> = {
  "Polity & Governance": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-350 border border-blue-200/50 dark:border-blue-800/30",
  "Economy": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-350 border border-emerald-200/50 dark:border-emerald-800/30",
  "Environment": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-350 border border-green-200/50 dark:border-green-800/30",
  "Science & Tech": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-350 border border-purple-200/50 dark:border-purple-800/30",
  "International Relations": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-350 border border-cyan-200/50 dark:border-cyan-800/30",
  "Assam Specific": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-350 border border-amber-200/50 dark:border-amber-800/30",
  "National Security": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-350 border border-rose-200/50 dark:border-rose-800/30",
  "Social Issues": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-350 border border-pink-200/50 dark:border-pink-800/30",
};

export function parseMarkdownToDigest(markdown: string): NewsDigest {
  const digest: NewsDigest = { india: [], assam: [], world: [] };
  let currentSection = "";
  let currentCategory = "";
  let pendingItem: Partial<NewsItem> | null = null;

  const commitItem = () => {
    if (!pendingItem || !pendingItem.headline || !currentSection) return;
    const section = digest[currentSection as keyof NewsDigest];
    if (!Array.isArray(section)) return;
    section.push({
      headline: pendingItem.headline || "",
      summary: pendingItem.summary || "",
      examRelevance: pendingItem.examRelevance || "",
      source: pendingItem.source || "",
      category: pendingItem.category || currentCategory || (currentSection === "assam" ? "Assam Specific" : ""),
      imageUrl: pendingItem.imageUrl || "",
    });
    pendingItem = null;
  };

  const lines = markdown.split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    const sectionMatch = t.match(/^#{1,3}\s*.{0,20}?(India|Assam|World)\s*$/iu);
    if (sectionMatch) {
      commitItem();
      const s = sectionMatch[1].toLowerCase();
      if (s === "india" || s === "assam" || s === "world") currentSection = s;
      currentCategory = "";
      continue;
    }

    const catMatch = t.match(/^#{1,3}\s+(.+)/);
    if (catMatch) {
      const val = catMatch[1].trim();
      if (!/^(India|Assam|World)$/i.test(val)) {
        commitItem();
        currentCategory = val.replace(/\*\*/g, "").trim();
      }
      continue;
    }

    const hlMatch = t.match(/^\*{0,2}Headline\*{0,2}\s*:?\s*(.+)/i);
    if (hlMatch) {
      commitItem();
      pendingItem = { headline: hlMatch[1].trim() };
      continue;
    }

    const smMatch = t.match(/^Summary\s*:?\s*(.+)/i);
    if (smMatch && pendingItem) {
      pendingItem.summary = smMatch[1].trim();
      continue;
    }

    const srcMatch = t.match(/^Source\s*:?\s*(.+?)(?:\s*[|–-]\s*Exam\s*(?::?\s*|Relevance\s*:?\s*)?(.+))?$/i);
    if (srcMatch && pendingItem) {
      pendingItem.source = srcMatch[1].trim();
      pendingItem.examRelevance = srcMatch[2]?.trim() || "";
      commitItem();
    }

    if (!pendingItem?.headline) {
      const altHl = t.match(/^(?:###\s*)?\*\*(.+?)\*\*(?:\s*:|$)/);
      if (altHl && t.length < 120) {
        commitItem();
        pendingItem = { headline: altHl[1].trim(), category: currentCategory };
      }
    }
  }

  commitItem();
  return digest;
}
