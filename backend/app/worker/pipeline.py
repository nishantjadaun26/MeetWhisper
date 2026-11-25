import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.db.models import Job, Meeting
from app.services.events import job_broadcaster
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def update_job_stage(
    job_id: str,
    status: str,
    progress: int,
    message: str,
    error: str = None
):
    """
    Updates the Job in the database and broadcasts SSE progress.
    """
    try:
        async with AsyncSessionLocal() as db:
            stmt = select(Job).where(Job.id == job_id)
            res = await db.execute(stmt)
            job = res.scalar_one_or_none()
            if job:
                job.status = status
                job.progress_percent = progress
                job.stage_message = message
                job.error_message = error
                if status in ("completed", "failed"):
                    job.completed_at = datetime.now(timezone.utc)
                await db.commit()
    except Exception as e:
        logger.error("Failed to update job stage in DB: %s", e)

    # Broadcast real-time SSE event
    await job_broadcaster.broadcast(
        job_id=job_id,
        status=status,
        progress_percent=progress,
        stage_message=message,
        error=error
    )


async def execute_processing_pipeline(job_id: str, meeting_id: str):
    """
    Executes the multi-stage AI/ML pipeline:
    normalizing -> transcribing -> chunking -> extracting_graph -> completed
    """
    try:
        # 1. Normalizing Audio
        await update_job_stage(job_id, "normalizing", 15, "Normalizing audio to 16 kHz mono WAV via ffmpeg...")
        from app.services.audio import normalize_to_wav
        from app.services.storage import storage_service

        async with AsyncSessionLocal() as db:
            stmt = select(Meeting).where(Meeting.id == meeting_id)
            res = await db.execute(stmt)
            meeting = res.scalar_one_or_none()
            if not meeting:
                raise ValueError("Meeting not found")

            meeting_dir = storage_service.get_meeting_dir(meeting_id)
            normalized_path = f"{meeting_dir}/normalized_16k.wav"
            success, msg = normalize_to_wav(meeting.file_path, normalized_path)
            meeting.normalized_audio_path = normalized_path
            await db.commit()

        # 2. Transcribing & Speaker Diarization
        await update_job_stage(job_id, "transcribing", 45, "Transcribing speech and labeling speakers...")
        from app.ml.transcriber import get_transcriber
        transcriber = get_transcriber()
        transcript_result = await transcriber.transcribe(normalized_path)

        async with AsyncSessionLocal() as db:
            from app.db.models import TranscriptSegment
            # Save segments to DB
            for idx, seg in enumerate(transcript_result.segments):
                t_seg = TranscriptSegment(
                    meeting_id=meeting_id,
                    speaker=seg.speaker,
                    start_time=seg.start_time,
                    end_time=seg.end_time,
                    text=seg.text,
                    confidence=seg.confidence,
                    words_json=[w.model_dump() for w in seg.words] if seg.words else None,
                    segment_order=idx
                )
                db.add(t_seg)
            await db.commit()

        # 3. Semantic Topic Chunking
        await update_job_stage(job_id, "chunking", 65, "Segmenting discussion topics using semantic embeddings...")
        from app.ml.chunker import chunk_transcript_segments
        topic_segments = await chunk_transcript_segments(transcript_result.segments)

        async with AsyncSessionLocal() as db:
            from app.db.models import TopicSegment
            for idx, t in enumerate(topic_segments):
                top_seg = TopicSegment(
                    meeting_id=meeting_id,
                    title=t.title,
                    summary=t.summary,
                    start_time=t.start_time,
                    end_time=t.end_time,
                    segment_order=idx,
                    embedding=t.embedding
                )
                db.add(top_seg)
            await db.commit()

        # 4. Extracting Structured Analysis & Visual Graph
        await update_job_stage(job_id, "extracting_graph", 85, "Synthesizing executive summary, action items, and visual flowchart...")
        from app.ml.extractor import extract_meeting_intelligence
        analysis_result = await extract_meeting_intelligence(
            meeting_title=meeting.title,
            transcript_segments=transcript_result.segments,
            topic_segments=topic_segments
        )

        async with AsyncSessionLocal() as db:
            from app.db.models import MeetingAnalysis
            m_analysis = MeetingAnalysis(
                meeting_id=meeting_id,
                executive_summary=analysis_result.executive_summary,
                decisions_json=[d.model_dump() for d in analysis_result.decisions],
                action_items_json=[a.model_dump() for a in analysis_result.action_items],
                open_questions_json=[q.model_dump() for q in analysis_result.open_questions],
                topics_json=[t.model_dump() for t in analysis_result.topic_segments],
                graph_type=analysis_result.graph_type,
                graph_json=analysis_result.graph.model_dump(),
                validation_attempts=1
            )
            db.add(m_analysis)
            await db.commit()

        # 5. Completed!
        await update_job_stage(job_id, "completed", 100, "Processing complete! All artifacts and graph generated.")

    except Exception as e:
        logger.exception("Error executing processing pipeline for job %s: %s", job_id, e)
        await update_job_stage(job_id, "failed", 0, f"Processing failed: {str(e)}", error=str(e))


def trigger_meeting_processing(job_id: str, meeting_id: str):
    """
    Dispatches background processing.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(execute_processing_pipeline(job_id, meeting_id))
    except RuntimeError:
        # No running loop in thread; start async run
        asyncio.run(execute_processing_pipeline(job_id, meeting_id))
