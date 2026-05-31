import logging

from fastapi import APIRouter, HTTPException

from api.task_tracker import get_task, list_tasks, request_cancel

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/tasks")
async def get_tasks(status: str | None = None):
    """List all recent tasks, optionally filtered by status."""
    tasks = await list_tasks(status)
    return {"tasks": tasks}


@router.get("/api/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Get detailed progress of a specific task."""
    task = await get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/api/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    """Request cancellation of a running task."""
    task = await get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["status"] not in ("pending", "running"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel task with status '{task['status']}'",
        )
    cancelled = await request_cancel(task_id)
    return {"success": cancelled, "task_id": task_id}
