import asyncio
import logging

from fastapi import APIRouter, HTTPException

from api.pending import get_pending, clear_pending, has_pending
from api.task_tracker import create_task, update_task, get_task, has_active_task
from graphs.ingestion_graph import run_ingestion

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/process/{subject}")
async def process_subject(subject: str):
    """
    Start background ingestion for all pending items of a subject.
    Returns immediately with a task_id for progress tracking.
    """
    if not await has_pending(subject):
        return {
            "success": True,
            "task_id": None,
            "message": f"No pending items for '{subject}'.",
            "processed": 0,
        }

    active_id = await has_active_task(subject)
    if active_id:
        return {
            "success": True,
            "task_id": active_id,
            "status": "already_running",
            "message": f"Processing already running for '{subject}'.",
        }

    task_id = await create_task(subject)
    asyncio.create_task(_run_pipeline(task_id, subject))
    return {
        "success": True,
        "task_id": task_id,
        "status": "started",
        "message": f"Processing started for '{subject}'.",
    }


async def _run_pipeline(task_id: str, subject: str):
    try:
        pending_items = await get_pending(subject)
        total = len(pending_items)
        await update_task(task_id, status="running", items_total=total)

        all_errors = []

        for i, item in enumerate(pending_items):
            topic = item["topic"]
            source_name = item["source_name"]
            raw_text = item["raw_text"]

            task_state = await get_task(task_id)
            if task_state and task_state.get("cancel_requested"):
                logger.info(f"[Process] Task {task_id} cancelled by user")
                await update_task(
                    task_id,
                    status="cancelled",
                    current_node="Cancelled",
                )
                return

            logger.info(
                f"[Process] [{i + 1}/{total}] Running pipeline for {subject}/{topic}"
            )
            await update_task(
                task_id,
                current_item=topic,
                current_node="Starting pipeline",
                items_completed=i,
                progress=int(i / total * 100) if total > 0 else 0,
            )

            async def _progress_callback(node: str, pct: int, status: str = "running"):
                task_state = await get_task(task_id)
                if task_state and task_state.get("cancel_requested"):
                    raise asyncio.CancelledError("Task cancelled by user")
                item_progress = int((i / total) * 100) if total > 0 else 0
                node_share = pct / total if total > 0 else pct
                overall = min(item_progress + int(node_share), 100)
                await update_task(
                    task_id,
                    current_node=node,
                    progress=overall,
                )

            try:
                result = await run_ingestion(
                    raw_text=raw_text,
                    subject=subject,
                    topic=topic,
                    source_name=source_name,
                    progress_callback=_progress_callback,
                )
                item_errors = result.get("errors", [])
                if item_errors:
                    all_errors.extend(item_errors)
                    logger.warning(
                        f"[Process] Errors for {subject}/{topic}: {item_errors}"
                    )
            except Exception as e:
                logger.error(f"[Process] Pipeline failed for {subject}/{topic}: {e}")
                all_errors.append(str(e))

        await clear_pending(subject)

        await update_task(
            task_id,
            status="completed" if not all_errors else "completed_with_errors",
            progress=100,
            current_node="Complete",
            items_completed=total,
            error="; ".join(all_errors[:5]) if all_errors else None,
        )
        logger.info(
            f"[Process] Task {task_id} completed: {total} item(s), "
            f"{len(all_errors)} error(s)"
        )

    except asyncio.CancelledError:
        await update_task(task_id, status="cancelled", current_node="Cancelled")
    except Exception as e:
        logger.error(f"[Process] Task {task_id} failed: {e}")
        await update_task(task_id, status="failed", current_node="Error", error=str(e))
