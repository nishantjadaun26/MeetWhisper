import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import AsyncSessionLocal
from app.db.models import Job, Meeting, TranscriptSegment, TopicSegment, MeetingAnalysis
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

    await job_broadcaster.broadcast(
        job_id=job_id,
        status=status,
        progress_percent=progress,
        stage_message=message,
        error=error
    )


async def execute_processing_pipeline(job_id: str, meeting_id: str, output_mode: str = "both"):
    """
    Executes the multi-stage AI/ML pipeline for audio or video recordings:
    normalizing -> transcribing -> chunking -> extracting (flowchart/notes/both) -> completed
    """
    try:
        # Check if meeting already has transcript segments (e.g. on-demand generation)
        async with AsyncSessionLocal() as db:
            stmt = select(Meeting).where(Meeting.id == meeting_id).options(
                selectinload(Meeting.transcript_segments),
                selectinload(Meeting.topic_segments),
                selectinload(Meeting.analysis)
            )
            res = await db.execute(stmt)
            meeting = res.scalar_one_or_none()
            if not meeting:
                raise ValueError("Meeting not found")

            existing_segments = meeting.transcript_segments
            existing_topics = meeting.topic_segments
            existing_analysis = meeting.analysis
            normalized_path = meeting.normalized_audio_path

        from app.ml.models import SegmentResult, TopicChunk

        # 1. Normalizing Audio (extracts 16kHz audio track from audio OR video)
        if not normalized_path or not existing_segments:
            await update_job_stage(job_id, "normalizing", 15, "Extracting & normalizing audio track via ffmpeg...")
            from app.services.audio import normalize_to_wav
            from app.services.storage import storage_service

            async with AsyncSessionLocal() as db:
                stmt = select(Meeting).where(Meeting.id == meeting_id)
                res = await db.execute(stmt)
                meeting = res.scalar_one()

                meeting_dir = storage_service.get_meeting_dir(meeting_id)
                normalized_path = f"{meeting_dir}/normalized_16k.wav"
                success, msg = normalize_to_wav(meeting.file_path, normalized_path)
                meeting.normalized_audio_path = normalized_path
                await db.commit()

        # 2. Transcribing & Speaker Diarization
        if not existing_segments:
            await update_job_stage(job_id, "transcribing", 45, "Transcribing speech and diarizing speakers...")
            from app.ml.transcriber import get_transcriber
            transcriber = get_transcriber()
            transcript_result = await transcriber.transcribe(normalized_path, title=meeting.title)

            async with AsyncSessionLocal() as db:
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
            
            raw_segments = transcript_result.segments
        else:
            raw_segments = [
                SegmentResult(
                    speaker=s.speaker,
                    start_time=s.start_time,
                    end_time=s.end_time,
                    text=s.text,
                    confidence=s.confidence
                )
                for s in existing_segments
            ]

        # 3. Semantic Topic Chunking
        if not existing_topics:
            await update_job_stage(job_id, "chunking", 65, "Detecting semantic topic boundaries...")
            from app.ml.chunker import chunk_transcript_segments
            topic_chunks = await chunk_transcript_segments(raw_segments)

            async with AsyncSessionLocal() as db:
                for idx, t in enumerate(topic_chunks):
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
            raw_topics = topic_chunks
        else:
            raw_topics = [
                TopicChunk(
                    title=t.title,
                    summary=t.summary,
                    start_time=t.start_time,
                    end_time=t.end_time,
                    segment_indices=[t.segment_order]
                )
                for t in existing_topics
            ]

        # 4. Intelligence Synthesis & Graph Extraction
        stage_desc = (
            "Generating visual flowchart..." if output_mode == "flowchart"
            else "Generating structured notes & summary..." if output_mode == "notes"
            else "Synthesizing notes and visual flowchart..."
        )
        await update_job_stage(job_id, "extracting_graph", 85, stage_desc)

        from app.ml.extractor import extract_meeting_intelligence
        analysis_result = await extract_meeting_intelligence(
            meeting_title=meeting.title,
            transcript_segments=raw_segments,
            topic_segments=raw_topics,
            output_mode=output_mode
        )

        async with AsyncSessionLocal() as db:
            # Check if analysis exists to update, or create new
            stmt = select(MeetingAnalysis).where(MeetingAnalysis.meeting_id == meeting_id)
            res = await db.execute(stmt)
            m_analysis = res.scalar_one_or_none()

            if not m_analysis:
                m_analysis = MeetingAnalysis(
                    meeting_id=meeting_id,
                    executive_summary=analysis_result.executive_summary if output_mode in ("notes", "both") else "",
                    decisions_json=[d.model_dump() for d in analysis_result.decisions] if output_mode in ("notes", "both") else [],
                    action_items_json=[a.model_dump() for a in analysis_result.action_items] if output_mode in ("notes", "both") else [],
                    open_questions_json=[q.model_dump() for q in analysis_result.open_questions] if output_mode in ("notes", "both") else [],
                    topics_json=[t.model_dump() for t in analysis_result.topic_segments] if output_mode in ("notes", "both") else [],
                    graph_type=analysis_result.graph_type,
                    graph_json=analysis_result.graph.model_dump() if output_mode in ("flowchart", "both") else {"nodes": [], "edges": []},
                    validation_attempts=1
                )
                db.add(m_analysis)
            else:
                # Merge or update depending on mode
                if output_mode in ("notes", "both"):
                    m_analysis.executive_summary = analysis_result.executive_summary
                    m_analysis.decisions_json = [d.model_dump() for d in analysis_result.decisions]
                    m_analysis.action_items_json = [a.model_dump() for a in analysis_result.action_items]
                    m_analysis.open_questions_json = [q.model_dump() for q in analysis_result.open_questions]
                    m_analysis.topics_json = [t.model_dump() for t in analysis_result.topic_segments]
                if output_mode in ("flowchart", "both"):
                    m_analysis.graph_type = analysis_result.graph_type
                    m_analysis.graph_json = analysis_result.graph.model_dump()

            await db.commit()

        # 5. Completed!
        await update_job_stage(job_id, "completed", 100, "Processing complete!")

    except Exception as e:
        logger.exception("Error executing processing pipeline for job %s: %s", job_id, e)
        await update_job_stage(job_id, "failed", 0, f"Processing failed: {str(e)}", error=str(e))


def trigger_meeting_processing(job_id: str, meeting_id: str, output_mode: str = "both"):
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(execute_processing_pipeline(job_id, meeting_id, output_mode))
    except RuntimeError:
        asyncio.run(execute_processing_pipeline(job_id, meeting_id, output_mode))
