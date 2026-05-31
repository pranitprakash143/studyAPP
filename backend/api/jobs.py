import uuid
import time
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

router = APIRouter()

# Simple in-memory store for background jobs (v1)
# In production, use Redis/ARQ or a database.
_jobs: Dict[str, Any] = {}

def create_job() -> str:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "id": job_id,
        "status": "processing",
        "created_at": time.time(),
        "result": None,
        "error": None
    }
    return job_id

def get_job(job_id: str) -> dict | None:
    return _jobs.get(job_id)

def update_job(job_id: str, status: str, result: Any = None, error: str = None):
    if job_id in _jobs:
        _jobs[job_id]["status"] = status
        if result is not None:
            _jobs[job_id]["result"] = result
        if error is not None:
            _jobs[job_id]["error"] = error

@router.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
