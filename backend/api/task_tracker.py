import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

_tasks: dict[str, dict] = {}
_lock = asyncio.Lock()
MAX_TASKS = 50


async def create_task(subject: str) -> str:
    async with _lock:
        task_id = uuid.uuid4().hex[:12]
        _tasks[task_id] = {
            "task_id": task_id,
            "subject": subject,
            "status": "pending",
            "progress": 0,
            "current_node": None,
            "nodes": [],
            "items_total": 0,
            "items_completed": 0,
            "current_item": None,
            "error": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "cancel_requested": False,
        }
        return task_id


async def update_task(task_id: str, **kwargs):
    async with _lock:
        if task_id in _tasks:
            _tasks[task_id].update(kwargs)
            _tasks[task_id]["updated_at"] = datetime.now(timezone.utc).isoformat()


async def get_task(task_id: str) -> Optional[dict]:
    async with _lock:
        return _tasks.get(task_id)


async def list_tasks(status_filter: Optional[str] = None) -> list[dict]:
    async with _lock:
        tasks = list(_tasks.values())
        if status_filter:
            tasks = [t for t in tasks if t["status"] == status_filter]
        tasks.sort(key=lambda t: t["created_at"], reverse=True)
        return tasks[:MAX_TASKS]


async def request_cancel(task_id: str) -> bool:
    async with _lock:
        if task_id in _tasks and _tasks[task_id]["status"] in ("pending", "running"):
            _tasks[task_id]["cancel_requested"] = True
            return True
        return False


async def has_active_task(subject: str) -> Optional[str]:
    async with _lock:
        for tid, t in _tasks.items():
            if t["subject"] == subject and t["status"] in ("pending", "running"):
                return tid
        return None
