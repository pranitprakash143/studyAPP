# ─────────────────────────────────────────────────────────────────────────────
# backend/api/wiki.py
# GET /api/wiki          → list all wiki pages (index)
# GET /api/wiki/graph    → full graph data (nodes + edges) for visualization
# GET /api/wiki/{subject}/{slug} → get single wiki page content
# ─────────────────────────────────────────────────────────────────────────────
import logging
import json
import re
from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse

from core.llm import generate_text
from wiki.wiki_compiler import get_wiki_index, get_wiki_page, list_wiki_pages

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/wiki")
async def list_wiki():
    """List all compiled wiki pages with metadata."""
    try:
        pages = list_wiki_pages()
        return JSONResponse({"pages": pages, "count": len(pages)})
    except Exception as e:
        logger.error(f"[API/wiki] list failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/wiki/graph")
async def wiki_graph():
    """
    Return the full wiki knowledge graph (nodes + edges) for visualization.
    Each node = wiki page; each edge = cross-topic connection with relationship label.
    """
    try:
        index = get_wiki_index()
        # Transform pages into graph nodes
        nodes = [
            {
                "id": p["id"],
                "label": p["title"],
                "subject": p["subject"],
                "tags": p.get("tags", []),
                "last_compiled": p.get("last_compiled", ""),
            }
            for p in index.get("pages", [])
        ]
        edges = index.get("edges", [])
        return JSONResponse(
            {
                "nodes": nodes,
                "edges": edges,
                "node_count": len(nodes),
                "edge_count": len(edges),
            }
        )
    except Exception as e:
        logger.error(f"[API/wiki] graph failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/wiki/{subject}/{slug}")
async def get_page(subject: str, slug: str):
    """Get a specific wiki page by subject and slug."""
    try:
        page = get_wiki_page(subject, slug)
        if not page:
            raise HTTPException(
                status_code=404,
                detail=f"Wiki page '{subject}/{slug}' not found.",
            )
        return JSONResponse(page)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API/wiki] get page {subject}/{slug} failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _generate_mindmap_local_fallback(content: str) -> dict:
    """
    Algorithmic/Heuristic fallback to extract a clean, beautiful, and highly interlinked
    knowledge graph offline without any LLM calls when API quota is exhausted.
    """
    import re
    
    nodes = []
    edges = []
    
    # 1. Parse headings as primary structural nodes
    headings = re.findall(r"^(?:#{1,4})\s+(.+)$", content, re.MULTILINE)
    heading_nodes = []
    for h in headings:
        h_clean = h.strip()
        h_id = re.sub(r"[^\w\s-]", "", h_clean.lower()).strip().replace(" ", "_")
        if h_id and h_clean:
            heading_nodes.append({"id": h_id, "label": h_clean})
            
    # 2. Extract bolded terms or definitions (e.g. **Concept**: definition)
    definitions = re.findall(r"\*\*(.*?)\*\*(?:\s*[:\-–]\s*|\s+is\s+)([^.\n]+)", content)
    def_nodes = []
    for term, definition in definitions:
        term_clean = term.strip()
        term_id = re.sub(r"[^\w\s-]", "", term_clean.lower()).strip().replace(" ", "_")
        if term_id and term_clean and len(term_clean) > 2:
            def_nodes.append({"id": term_id, "label": term_clean})
            
    # Combine nodes and deduplicate by ID
    all_nodes_map = {}
    for n in heading_nodes + def_nodes:
        all_nodes_map[n["id"]] = n["label"]
        
    # If we still have too few nodes, extract other bolded phrases as concepts
    if len(all_nodes_map) < 8:
        other_bolds = re.findall(r"\*\*(.*?)\*\*", content)
        for b in other_bolds:
            b_clean = b.strip()
            b_id = re.sub(r"[^\w\s-]", "", b_clean.lower()).strip().replace(" ", "_")
            if b_id and b_clean and len(b_clean) > 2 and len(b_clean) < 40:
                all_nodes_map[b_id] = b_clean
                
    # Fallback to simple words if empty
    if not all_nodes_map:
        capitalized = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", content)
        for cap in capitalized[:15]:
            cap_clean = cap.strip()
            cap_id = re.sub(r"[^\w\s-]", "", cap_clean.lower()).strip().replace(" ", "_")
            if cap_id and len(cap_clean) > 2:
                all_nodes_map[cap_id] = cap_clean
                
    # Reconstruct final unique nodes list
    final_nodes = [{"id": k, "label": v} for k, v in all_nodes_map.items()]
    
    # 3. Establish relationships (edges)
    node_ids = list(all_nodes_map.keys())
    
    if len(node_ids) > 1:
        # Hierarchical/sequential linking
        for idx in range(len(node_ids) - 1):
            edges.append({
                "source": node_ids[idx],
                "target": node_ids[idx + 1],
                "label": "advances to" if idx % 2 == 0 else "connects to"
            })
            
        # Contextual/co-occurrence linking: search sentences
        sentences = re.split(r"[.!?\n]+", content)
        co_occurrences = {}
        
        for sent in sentences:
            sent_lower = sent.lower()
            found = [nid for nid in node_ids if nid.replace("_", " ") in sent_lower]
            if len(found) > 1:
                for idx_a in range(len(found)):
                    for idx_b in range(idx_a + 1, len(found)):
                        pair = tuple(sorted([found[idx_a], found[idx_b]]))
                        co_occurrences[pair] = co_occurrences.get(pair, 0) + 1
                        
        sorted_pairs = sorted(co_occurrences.items(), key=lambda x: x[1], reverse=True)
        added_dense = 0
        for (src, tgt), freq in sorted_pairs:
            if not any(e["source"] == src and e["target"] == tgt for e in edges):
                edges.append({
                    "source": src,
                    "target": tgt,
                    "label": "associated with"
                })
                added_dense += 1
                if added_dense >= 10:
                    break
                    
    if not final_nodes:
        final_nodes = [{"id": "general_study_notes", "label": "General Study Notes"}]
        
    return {"nodes": final_nodes, "edges": edges}


@router.post("/api/wiki/{subject}/{slug}/mindmap")
async def generate_mindmap(subject: str, slug: str, payload: dict = Body(default=None)):
    """Generate a mindmap knowledge graph from notes context or compiled wiki page."""
    try:
        content = ""
        # 1. Check if direct notes context payload is supplied
        if payload and isinstance(payload, dict):
            content = payload.get("content", "")
            
        # 2. Fall back to loading the compiled wiki page from file
        if not content:
            page = get_wiki_page(subject, slug)
            if page:
                content = page.get("body") or page.get("raw") or ""
                
        if not content:
            raise HTTPException(
                status_code=400,
                detail=f"No notes content or compiled wiki page found for '{subject}/{slug}'."
            )
            
        system = (
            "You are a professional knowledge-graph architect. Your task is to analyze the provided study notes "
            "and extract a highly structured, beautiful, and deeply interlinked academic mindmap (knowledge graph).\n\n"
            "Guidelines:\n"
            "1. **Nodes (Concepts)**: Extract 10-25 key concepts, definitions, paradigms, theories, or entities. "
            "Each node must have a unique 'id' in clean snake_case and a human-readable 'label' (e.g., 'artificial_intelligence' -> 'Artificial Intelligence').\n"
            "2. **Edges (Relationships)**: Create a rich, dense web of relationships. Do not just build a simple tree. "
            "Interlink concepts horizontally and vertically with clear, active relation labels (e.g. 'implements', 'mitigates', 'defines', 'depends_on', 'example_of', 'part_of').\n"
            "3. **Connectivity**: Ensure there are no isolated nodes. Interlink related sub-concepts to show deep visual relationships.\n"
            "4. **Strict JSON Output**: Output ONLY a raw, valid JSON object matching the schema below. No markdown formatting, no code fences, no extra text.\n\n"
            "JSON SCHEMA:\n"
            "{\n"
            "  \"nodes\": [\n"
            "    {\"id\": \"concept_id\", \"label\": \"Concept Name\"}\n"
            "  ],\n"
            "  \"edges\": [\n"
            "    {\"source\": \"concept_id\", \"target\": \"related_concept_id\", \"label\": \"relationship description\"}\n"
            "  ]\n"
            "}"
        )
        prompt = f"STUDY NOTES SECTION CONTENT:\n---\n{content}\n---\nExtract the knowledge graph."
        
        try:
            resp = await generate_text(prompt, system_prompt=system, json_mode=True, timeout=60)
            
            # safe parse json
            cleaned = resp.strip()
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).rstrip("```").strip()
            graph = json.loads(cleaned)
        except Exception as api_err:
            logger.warning(f"[API/wiki] AI mindmap generation failed (falling back to offline heuristic): {api_err}")
            graph = _generate_mindmap_local_fallback(content)
        
        return JSONResponse({"mindmap": graph})
        
    except Exception as e:
        logger.error(f"[API/wiki] mindmap generation for {subject}/{slug} failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
