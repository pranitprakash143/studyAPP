# backend/api/query.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from vectorstore.chroma_store import query_chunks

router = APIRouter()


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Search query")
    subject: str | None = Field(None, description="Filter by subject")
    top_k: int = Field(5, ge=1, le=20)


@router.post("/api/query")
async def semantic_query(req: QueryRequest):
    """Semantic search over the knowledge base."""
    try:
        results = await query_chunks(
            query=req.query,
            subject=req.subject,
            top_k=req.top_k,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"query": req.query, "results": results, "count": len(results)}
