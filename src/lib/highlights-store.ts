import fs from "fs";
import path from "path";

export interface Highlight {
  id: string;
  subject: string;
  topic: string;
  text: string;
  color: "yellow" | "green" | "pink" | "blue";
  createdAt: string;
  note?: string; // Personal annotation / sticky comment
}

const KB_DIR = path.join(process.cwd(), "knowledge_base");
const METADATA_DIR = path.join(KB_DIR, "metadata");
const HIGHLIGHTS_DB_PATH = path.join(METADATA_DIR, "highlights.json");

function ensureDirsExist() {
  if (!fs.existsSync(KB_DIR)) {
    fs.mkdirSync(KB_DIR, { recursive: true });
  }
  if (!fs.existsSync(METADATA_DIR)) {
    fs.mkdirSync(METADATA_DIR, { recursive: true });
  }
}

export function loadHighlights(): Highlight[] {
  ensureDirsExist();
  if (fs.existsSync(HIGHLIGHTS_DB_PATH)) {
    try {
      const data = fs.readFileSync(HIGHLIGHTS_DB_PATH, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      console.error("Error reading highlights DB:", e);
      return [];
    }
  }
  return [];
}

export function saveHighlights(highlights: Highlight[]) {
  ensureDirsExist();
  fs.writeFileSync(HIGHLIGHTS_DB_PATH, JSON.stringify(highlights, null, 2), "utf-8");
}

export function addHighlight(highlight: Omit<Highlight, "createdAt">): Highlight {
  const highlights = loadHighlights();
  
  const newHighlight: Highlight = {
    ...highlight,
    createdAt: new Date().toISOString()
  };
  
  // If it already exists, replace it
  const index = highlights.findIndex(h => h.id === highlight.id);
  if (index >= 0) {
    highlights[index] = newHighlight;
  } else {
    highlights.push(newHighlight);
  }
  
  saveHighlights(highlights);
  return newHighlight;
}

export function deleteHighlight(id: string): boolean {
  const highlights = loadHighlights();
  const initialLength = highlights.length;
  const filtered = highlights.filter(h => h.id !== id);
  
  if (filtered.length < initialLength) {
    saveHighlights(filtered);
    return true;
  }
  return false;
}
