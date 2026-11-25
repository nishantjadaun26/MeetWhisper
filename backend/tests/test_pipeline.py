import os
import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models import Meeting, Job
from app.db.session import AsyncSessionLocal
from app.worker.pipeline import execute_processing_pipeline


@pytest.mark.asyncio
async def test_execute_processing_pipeline(db_session):
    test_file = "./uploads/test_pipeline_meeting.wav"
    os.makedirs("./uploads", exist_ok=True)
    with open(test_file, "wb") as f:
        f.write(b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00")

    async with AsyncSessionLocal() as session:
        meeting = Meeting(
            title="Sample Architecture Review",
            filename="test_pipeline_meeting.wav",
            file_path=test_file,
            file_size_bytes=len(test_file),
            mime_type="audio/wav",
            duration_seconds=66.0
        )
        session.add(meeting)
        await session.flush()

        job = Job(
            meeting_id=meeting.id,
            status="queued",
            progress_percent=0,
            stage_message="Queued"
        )
        session.add(job)
        await session.commit()
        meeting_id = meeting.id
        job_id = job.id

    # Execute full pipeline
    await execute_processing_pipeline(job_id, meeting_id)

    # Check outcomes with fresh session
    async with AsyncSessionLocal() as session:
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
        res = await session.execute(stmt)
        m = res.scalar_one()

        # Verify job completed
        assert m.jobs[0].status == "completed"
        assert m.jobs[0].progress_percent == 100

        # Verify transcript segments
        assert len(m.transcript_segments) > 0
        assert m.transcript_segments[0].speaker != ""

        # Verify topic segments
        assert len(m.topic_segments) > 0

        # Verify analysis & graph
        assert m.analysis is not None
        assert len(m.analysis.decisions_json) > 0
        assert len(m.analysis.action_items_json) > 0
        assert len(m.analysis.graph_json["nodes"]) > 0
        assert len(m.analysis.graph_json["edges"]) > 0
