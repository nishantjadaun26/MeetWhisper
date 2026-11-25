import os
import mimetypes
from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    Form,
    HTTPException,
    Request,
    status
)
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user_optional
from app.db.session import get_db
from app.db.models import Meeting, Job, TranscriptSegment, MeetingAnalysis, TopicSegment, User
from app.schemas.meeting import MeetingResponse, MeetingDetailResponse
from app.services.storage import storage_service
from app.services.audio import (
    is_supported_audio_extension,
    get_audio_duration_seconds,
    range_requests_response_generator
)
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_meeting(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    output_mode: Optional[str] = Form("both"),  # 'flowchart' | 'notes' | 'both'
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file has no filename")

    if not is_supported_audio_extension(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{file.filename}'. Allowed: mp3, wav, m4a, mp4, webm, mov, mkv, avi, ogg, flac, aac"
        )

    # Save to disk
    meeting_title = title.strip() if title and title.strip() else os.path.splitext(file.filename)[0].replace("_", " ").title()
    mime = file.content_type or mimetypes.guess_type(file.filename)[0] or "audio/mpeg"
    meeting = Meeting(
        user_id=current_user.id if current_user else None,
        title=meeting_title,
        filename=file.filename,
        file_path="",
        file_size_bytes=0,
        mime_type=mime,
        duration_seconds=0.0
    )
    db.add(meeting)
    await db.flush()

    try:
        saved_path, file_size = await storage_service.save_uploaded_file(file, meeting.id)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Check max size
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file_size > max_bytes:
        storage_service.delete_meeting_files(meeting.id)
        await db.rollback()
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB"
        )

    duration = get_audio_duration_seconds(saved_path)
    meeting.file_path = saved_path
    meeting.file_size_bytes = file_size
    meeting.duration_seconds = duration

    # Create Initial Job
    mode = (output_mode or "both").lower()
    if mode not in ("flowchart", "notes", "both"):
        mode = "both"

    job = Job(
        meeting_id=meeting.id,
        status="queued",
        progress_percent=0,
        stage_message=f"Job queued for processing ({mode} mode)"
    )
    db.add(job)
    await db.commit()
    await db.refresh(meeting)
    await db.refresh(job)

    # Trigger processing pipeline hook
    from app.worker.pipeline import trigger_meeting_processing
    trigger_meeting_processing(job.id, meeting.id, output_mode=mode)

    return {
        "meeting_id": meeting.id,
        "job_id": job.id,
        "title": meeting.title,
        "filename": meeting.filename,
        "file_size_bytes": meeting.file_size_bytes,
        "duration_seconds": meeting.duration_seconds,
        "output_mode": mode,
        "status": job.status
    }


@router.post("/{meeting_id}/generate")
async def generate_artifact_on_demand(
    meeting_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    Allows generating flowchart, notes, or both on-demand after upload.
    """
    mode = body.get("mode", "both")
    stmt = select(Meeting).where(Meeting.id == meeting_id).options(selectinload(Meeting.jobs))
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    job = Job(
        meeting_id=meeting.id,
        status="queued",
        progress_percent=0,
        stage_message=f"Generating {mode}..."
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.worker.pipeline import trigger_meeting_processing
    trigger_meeting_processing(job.id, meeting.id, output_mode=mode)

    return {"job_id": job.id, "meeting_id": meeting_id, "mode": mode}


@router.get("", response_model=List[MeetingResponse])
async def list_meetings(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    stmt = select(Meeting).options(selectinload(Meeting.jobs))
    if current_user:
        stmt = stmt.where(or_(Meeting.user_id == current_user.id, Meeting.user_id.is_(None)))
    else:
        stmt = stmt.where(Meeting.user_id.is_(None))
    stmt = stmt.order_by(desc(Meeting.created_at))
    result = await db.execute(stmt)
    meetings = result.scalars().all()

    response = []
    for m in meetings:
        latest_job = sorted(m.jobs, key=lambda j: j.created_at, reverse=True)[0] if m.jobs else None
        response.append(
            MeetingResponse(
                id=m.id,
                title=m.title,
                filename=m.filename,
                file_size_bytes=m.file_size_bytes,
                mime_type=m.mime_type,
                duration_seconds=m.duration_seconds,
                created_at=m.created_at,
                updated_at=m.updated_at,
                status=latest_job.status if latest_job else "completed",
                progress_percent=latest_job.progress_percent if latest_job else 100
            )
        )
    return response


@router.get("/{meeting_id}", response_model=MeetingDetailResponse)
async def get_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Meeting)
        .where(Meeting.id == meeting_id)
        .options(
            selectinload(Meeting.jobs),
            selectinload(Meeting.transcript_segments),
            selectinload(Meeting.topic_segments),
            selectinload(Meeting.analysis)
        )
    )
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    latest_job = sorted(meeting.jobs, key=lambda j: j.created_at, reverse=True)[0] if meeting.jobs else None

    return MeetingDetailResponse(
        id=meeting.id,
        title=meeting.title,
        filename=meeting.filename,
        file_size_bytes=meeting.file_size_bytes,
        mime_type=meeting.mime_type,
        duration_seconds=meeting.duration_seconds,
        normalized_audio_path=meeting.normalized_audio_path,
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
        status=latest_job.status if latest_job else "completed",
        progress_percent=latest_job.progress_percent if latest_job else 100,
        transcript_segments=meeting.transcript_segments,
        topic_segments=meeting.topic_segments,
        analysis=meeting.analysis
    )


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Meeting).where(Meeting.id == meeting_id)
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    storage_service.delete_meeting_files(meeting_id)
    await db.delete(meeting)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{meeting_id}/audio")
async def stream_meeting_audio(
    meeting_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Streams audio/video with HTTP Range header support for scrubbing in audio waveforms.
    """
    stmt = select(Meeting).where(Meeting.id == meeting_id)
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()
    if not meeting or not meeting.file_path or not os.path.exists(meeting.file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    file_path = meeting.file_path
    file_size = os.path.getsize(file_path)
    mime_type = meeting.mime_type or "audio/mpeg"

    range_header = request.headers.get("range")
    if not range_header:
        headers = {
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
            "Content-Type": mime_type,
        }
        return StreamingResponse(
            range_requests_response_generator(file_path, 0, file_size - 1),
            headers=headers,
            status_code=status.HTTP_200_OK
        )

    # Partial Range Request
    try:
        range_val = range_header.strip().lower()
        if not range_val.startswith("bytes="):
            raise ValueError("Invalid range prefix")

        parts = range_val.replace("bytes=", "").split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1

        if start >= file_size or end >= file_size or start > end:
            return Response(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                headers={"Content-Range": f"bytes */{file_size}"}
            )

        content_length = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": mime_type,
        }

        return StreamingResponse(
            range_requests_response_generator(file_path, start, end),
            headers=headers,
            status_code=status.HTTP_206_PARTIAL_CONTENT
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Range header")
