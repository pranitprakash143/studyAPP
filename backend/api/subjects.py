from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from vectorstore.chroma_store import (
    list_subjects,
    get_subject_chunks,
    delete_subject,
    delete_topic,
)

class ChunkInput(BaseModel):
    title: str
    content: str

class SubjectSaveInput(BaseModel):
    chunks: list[ChunkInput]

router = APIRouter()


@router.post("/api/subject/{subject_name}/save")
async def save_subject(subject_name: str, payload: SubjectSaveInput):
    """Save/overwrite all chunks for a subject directly without running the ingestion graph."""
    try:
        # Delete first to overwrite
        await delete_subject(subject_name)
        
        # Format into chroma-ready dicts
        chroma_chunks = [{"title": c.title, "content": c.content} for c in payload.chunks]
        
        # Save each chunk
        from vectorstore.chroma_store import upsert_chunks
        count = await upsert_chunks(chroma_chunks, subject_name, "Edited Notes", "Manual Edit")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "chunks_added": count}


@router.get("/api/subjects")
async def get_subjects():
    """List all subjects in the knowledge base with topic counts."""
    try:
        subjects = await list_subjects()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"subjects": subjects, "count": len(subjects)}


@router.get("/api/subject/{subject_name}")
async def get_subject(subject_name: str):
    """Get all chunks for a subject, ordered by topic."""
    try:
        chunks = await get_subject_chunks(subject_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not chunks:
        raise HTTPException(status_code=404, detail=f"No content found for subject '{subject_name}'")

    # Group by topic
    topics: dict[str, list[dict]] = {}
    for chunk in chunks:
        t = chunk["topic"]
        if t not in topics:
            topics[t] = []
        topics[t].append(chunk)

    return {
        "subject": subject_name,
        "topic_count": len(topics),
        "topics": topics,
    }


@router.delete("/api/subject/{subject_name}")
async def remove_subject(subject_name: str):
    """Delete all chunks for a subject."""
    try:
        deleted = await delete_subject(subject_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"deleted": deleted, "subject": subject_name}


@router.delete("/api/subject/{subject_name}/topic/{topic_name}")
async def remove_topic(subject_name: str, topic_name: str):
    """Delete all chunks for a specific topic."""
    try:
        deleted = await delete_topic(subject_name, topic_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"deleted": deleted, "subject": subject_name, "topic": topic_name}
