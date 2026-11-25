import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import Job
from app.schemas.job import JobResponse
from app.services.events import job_broadcaster

router = APIRouter()


@router.get("/{job_id}", response_model=JobResponse)
async def get_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Job).where(Job.id == job_id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/{job_id}/stream")
async def stream_job_progress(job_id: str):
    """
    Streams real-time job progress events using Server-Sent Events (SSE).
    """
    # 1. Fetch current status from DB
    async with AsyncSessionLocal() as db:
        stmt = select(Job).where(Job.id == job_id)
        result = await db.execute(stmt)
        job = result.scalar_one_or_none()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        initial_status = {
            "job_id": job.id,
            "status": job.status,
            "progress_percent": job.progress_percent,
            "stage_message": job.stage_message,
            "error_message": job.error_message,
        }

    async def event_generator():
        # First send initial snapshot
        yield f"event: progress\ndata: {json.dumps(initial_status)}\n\n"
        if initial_status["status"] in ("completed", "failed"):
            return

        # Then subscribe to live updates
        async for chunk in job_broadcaster.subscribe(job_id):
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
