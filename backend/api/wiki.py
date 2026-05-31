# ─────────────────────────────────────────────────────────────────────────────
# backend/api/wiki.py
# GET /api/wiki          → list all wiki pages (index)
# GET /api/wiki/graph    → full graph data (nodes + edges) for visualization
# GET /api/wiki/{subject}/{slug} → get single wiki page content
# ─────────────────────────────────────────────────────────────────────────────
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

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
