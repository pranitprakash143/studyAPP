import os
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


def parse_markdown_to_topics(markdown_text: str) -> dict[str, list[dict]]:
    """Parse raw binder markdown text into grouped chapters/topics structure."""
    topics = {}
    current_topic = "General"
    current_sources = "Manual Edit"
    lines = markdown_text.split("\n")
    current_chunk_lines = []

    for line in lines:
        if line.startswith("## "):
            # Output previous topic chunks
            if current_chunk_lines:
                content = "\n".join(current_chunk_lines).strip()
                if content:
                    topics.setdefault(current_topic, []).append(
                        {
                            "content": content,
                            "source": current_sources,
                            "topic": current_topic,
                            "chapter": current_topic,
                            "subtopic": "",
                        }
                    )
                current_chunk_lines = []

            # Extract new topic name
            fullName = line[3:].strip()
            current_topic = fullName.replace("Topic:", "").strip()
            current_sources = "Manual Edit"
        elif line.startswith("* **Sources**:"):
            current_sources = line.replace("* **Sources**:", "").strip()
        elif line.strip() == "---":
            continue
        else:
            current_chunk_lines.append(line)

    # Output final chunk
    if current_chunk_lines:
        content = "\n".join(current_chunk_lines).strip()
        if content:
            topics.setdefault(current_topic, []).append(
                {
                    "content": content,
                    "source": current_sources,
                    "topic": current_topic,
                    "chapter": current_topic,
                    "subtopic": "",
                }
            )

    return topics


@router.post("/api/subject/{subject_name}/save")
async def save_subject(subject_name: str, payload: SubjectSaveInput):
    """Save/overwrite binder notes to a local markdown file and sync to ChromaDB index."""
    try:
        # 1. Save to local markdown file (Single Source of Truth)
        binders_dir = os.path.join("knowledge_base", "binders")
        os.makedirs(binders_dir, exist_ok=True)
        filepath = os.path.join(binders_dir, f"{subject_name}.md")

        markdown_content = f"# Subject: {subject_name}\n\n"
        for chunk in payload.chunks:
            title = chunk.title
            if title.startswith("Topic:"):
                title = title.replace("Topic:", "").strip()
            markdown_content += f"## Topic: {title}\n"
            markdown_content += f"{chunk.content}\n\n"
            markdown_content += "---\n\n"

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(markdown_content.strip() + "\n")

        # 2. Sync / Update ChromaDB index (Secondary Retrieval Index)
        await delete_subject(subject_name)

        from vectorstore.chroma_store import upsert_chunks

        count = 0
        for c in payload.chunks:
            chroma_chunks = [{"title": c.title, "content": c.content}]
            count += await upsert_chunks(
                chroma_chunks, subject_name, c.title, "Manual Edit"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "chunks_added": count}


@router.get("/api/subjects")
async def get_subjects():
    """List all subjects in the knowledge base (either local markdown files or vector store)."""
    try:
        # Combine local binder files list and ChromaDB list
        subjects_set = set()

        # Local files
        binders_dir = os.path.join("knowledge_base", "binders")
        if os.path.exists(binders_dir):
            for file in os.listdir(binders_dir):
                if file.endswith(".md"):
                    subjects_set.add(file[:-3])

        # ChromaDB subjects
        db_subjects = await list_subjects()
        for s in db_subjects:
            subjects_set.add(s["subject"])

        subjects_list = []
        for s in sorted(subjects_set):
            # Check if exists in ChromaDB list to get topics list
            db_match = next((x for x in db_subjects if x["subject"] == s), None)
            if db_match:
                subjects_list.append(db_match)
            else:
                subjects_list.append({"subject": s, "topic_count": 0, "topics": []})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"subjects": subjects_list, "count": len(subjects_list)}


@router.get("/api/subject/{subject_name}")
async def get_subject(subject_name: str):
    """Get all binder notes for a subject (either from file or ChromaDB fallback)."""
    try:
        filepath = os.path.join("knowledge_base", "binders", f"{subject_name}.md")
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                markdown_content = f.read()

            topics = parse_markdown_to_topics(markdown_content)
            return {
                "subject": subject_name,
                "markdown": markdown_content,
                "topic_count": len(topics),
                "topics": topics,
                "from_file": True,
            }

        chunks = await get_subject_chunks(subject_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not chunks:
        raise HTTPException(
            status_code=404, detail=f"No content found for subject '{subject_name}'"
        )

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
    """Delete a subject from both filesystem and ChromaDB."""
    try:
        # Delete local markdown file
        filepath = os.path.join("knowledge_base", "binders", f"{subject_name}.md")
        if os.path.exists(filepath):
            os.remove(filepath)

        # Delete from ChromaDB
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
