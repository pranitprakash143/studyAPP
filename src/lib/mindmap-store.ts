import fs from "fs";
import path from "path";

export interface MindmapNode {
  id: string;
  label: string;
}

export interface MindmapEdge {
  source: string;
  target: string;
  label: string; // e.g. "causes", "part of", "related to"
}

export interface MindmapGraph {
  subject: string;
  topic: string;
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  updatedAt: string;
}

const KB_DIR = path.join(process.cwd(), "knowledge_base");
const METADATA_DIR = path.join(KB_DIR, "metadata");
const MINDMAPS_DB_PATH = path.join(METADATA_DIR, "mindmaps.json");

function ensureDirsExist() {
  if (!fs.existsSync(KB_DIR)) {
    fs.mkdirSync(KB_DIR, { recursive: true });
  }
  if (!fs.existsSync(METADATA_DIR)) {
    fs.mkdirSync(METADATA_DIR, { recursive: true });
  }
}

export function loadMindmaps(): MindmapGraph[] {
  ensureDirsExist();
  if (fs.existsSync(MINDMAPS_DB_PATH)) {
    try {
      const data = fs.readFileSync(MINDMAPS_DB_PATH, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      console.error("Error reading mindmaps DB:", e);
      return [];
    }
  }
  return [];
}

export function saveMindmaps(graphs: MindmapGraph[]) {
  ensureDirsExist();
  fs.writeFileSync(MINDMAPS_DB_PATH, JSON.stringify(graphs, null, 2), "utf-8");
}

export function appendMindmap(subject: string, topic: string, nodes: MindmapNode[], edges: MindmapEdge[]) {
  const graphs = loadMindmaps();
  
  // Update if exists, else add new
  const existingIndex = graphs.findIndex(g => g.subject === subject && g.topic === topic);
  
  const newGraph: MindmapGraph = {
    subject,
    topic,
    nodes,
    edges,
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    // If it exists, we could merge nodes/edges, but for simplicity of a file upload,
    // we'll just merge them naively (adding new unique nodes/edges) or overwrite.
    // Overwriting is safer for single-doc topics. We'll merge by ID.
    const existing = graphs[existingIndex];
    const nodeMap = new Map<string, MindmapNode>(existing.nodes.map(n => [n.id, n]));
    nodes.forEach(n => nodeMap.set(n.id, n));
    
    // Naive edge merge
    const mergedEdges = [...existing.edges];
    for (const edge of edges) {
      if (!mergedEdges.some(e => e.source === edge.source && e.target === edge.target)) {
        mergedEdges.push(edge);
      }
    }

    graphs[existingIndex] = {
      ...newGraph,
      nodes: Array.from(nodeMap.values()),
      edges: mergedEdges
    };
  } else {
    graphs.push(newGraph);
  }

  saveMindmaps(graphs);
}
