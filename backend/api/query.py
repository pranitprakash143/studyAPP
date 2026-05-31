# backend/api/query.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from vectorstore.chroma_store import query_chunks, query_chunks_with_hyde

router = APIRouter()


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Search query")
    subject: str | None = Field(None, description="Filter by subject")
    top_k: int = Field(5, ge=1, le=20)
    use_hyde: bool = Field(
        True,
        description=(
            "Use HyDE (Hypothetical Document Embeddings) retrieval. "
            "Generates a hypothetical ideal answer before embedding for better recall. "
            "Falls back to standard retrieval on failure. Default: True."
        ),
    )


@router.post("/api/query")
async def semantic_query(req: QueryRequest):
    """
    Semantic search over the knowledge base.

    When use_hyde=True (default), applies HyDE retrieval:
    the LLM first generates a hypothetical ideal answer to the query,
    then embeds THAT answer for ChromaDB search. This bridges the
    query-document linguistic gap and improves recall by 15-30%.
    """
    try:
        if req.use_hyde:
            results = await query_chunks_with_hyde(
                query=req.query,
                subject=req.subject,
                top_k=req.top_k,
            )
        else:
            results = await query_chunks(
                query=req.query,
                subject=req.subject,
                top_k=req.top_k,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "query": req.query,
        "results": results,
        "count": len(results),
        "retrieval_method": "hyde" if req.use_hyde else "standard",
    }
