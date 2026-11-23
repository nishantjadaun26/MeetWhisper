import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from app.db.base import Base
from app.db.session import engine, AsyncSessionLocal
from app.db.models import Meeting, Job, TranscriptSegment, TopicSegment, MeetingAnalysis


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        res = await db.execute(select(Meeting))
        if res.scalars().first():
            print("Database already has meetings. Skipping seed.")
            return

        print("Seeding sample meeting...")
        os.makedirs("./uploads/sample_meeting", exist_ok=True)
        sample_audio = "./uploads/sample_meeting/sample.wav"
        with open(sample_audio, "wb") as f:
            f.write(b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00")

        meeting = Meeting(
            id="sample-architecture-review",
            title="Monolith to Mesh Architecture Review",
            filename="sample.wav",
            file_path=sample_audio,
            file_size_bytes=64000,
            mime_type="audio/wav",
            duration_seconds=66.0,
            normalized_audio_path=sample_audio
        )
        db.add(meeting)

        job = Job(
            meeting_id=meeting.id,
            status="completed",
            progress_percent=100,
            stage_message="Processing complete! All artifacts and graph generated."
        )
        db.add(job)

        sample_segments = [
            ("Alex (Tech Lead)", 0.0, 7.5, "Welcome everyone. Today we're reviewing the migration from our legacy monolith to the microservices event mesh."),
            ("Elena (Backend Dev)", 8.0, 18.2, "On the database side, we've benchmarked PostgreSQL with pgvector against Milvus. pgvector delivered lower operational overhead and 12ms p99 latency."),
            ("Alex (Tech Lead)", 18.5, 25.0, "Agreed. Let's make an explicit decision: we will standardize on PostgreSQL 16 with pgvector for our vector embeddings."),
            ("Marcus (DevOps)", 25.5, 36.0, "I have an open question: what is our disaster recovery RPO for the streaming replication replicas in us-west-2?"),
            ("Marcus (DevOps)", 36.5, 48.0, "For action items, I will configure the automated WAL shipping to S3 and document the failover drill by this Thursday."),
            ("Elena (Backend Dev)", 48.5, 58.0, "And I'll finalize the Alembic migration scripts and commit the baseline models by Wednesday afternoon."),
            ("Alex (Tech Lead)", 58.5, 66.0, "Sounds great team. Let's wrap up and regroup after the staging deployment.")
        ]

        for idx, (spk, st, en, text) in enumerate(sample_segments):
            seg = TranscriptSegment(
                meeting_id=meeting.id,
                speaker=spk,
                start_time=st,
                end_time=en,
                text=text,
                confidence=0.98,
                segment_order=idx
            )
            db.add(seg)

        topic_segments = [
            ("Topic 1: Monolith Migration Overview", "Discussion on decomposing monolith into event-driven mesh.", 0.0, 25.0),
            ("Topic 2: Database Benchmarks & Decision", "Evaluated Milvus vs pgvector, concluding on PostgreSQL 16.", 8.0, 25.0),
            ("Topic 3: Disaster Recovery & Replication", "Reviewed us-west-2 failover SLA and RPO targets.", 25.5, 48.0),
            ("Topic 4: Sprint Action Items & Milestones", "WAL shipping to S3 and Alembic migration commitments.", 36.5, 66.0)
        ]

        for idx, (title, summary, st, en) in enumerate(topic_segments):
            ts = TopicSegment(
                meeting_id=meeting.id,
                title=title,
                summary=summary,
                start_time=st,
                end_time=en,
                segment_order=idx
            )
            db.add(ts)

        analysis = MeetingAnalysis(
            meeting_id=meeting.id,
            executive_summary="The engineering leadership evaluated the architectural migration from legacy monolithic storage to a scalable event mesh. Key benchmarks confirmed PostgreSQL 16 with pgvector delivers superior developer velocity and satisfies 12ms p99 latency targets. Failover drill documentation and Alembic model migrations were assigned for staging rollout.",
            decisions_json=[
                {
                    "statement": "Standardize on PostgreSQL 16 with pgvector for vector embeddings",
                    "context": "Evaluated against Milvus; pgvector delivered lower operational overhead and 12ms p99 latency",
                    "speaker": "Alex (Tech Lead)",
                    "timestamp_start": 18.5,
                    "timestamp_end": 25.0
                }
            ],
            action_items_json=[
                {
                    "task": "Configure automated WAL shipping to S3 and document failover drill",
                    "owner": "Marcus (DevOps)",
                    "deadline": "Thursday",
                    "timestamp_start": 36.5,
                    "timestamp_end": 48.0
                },
                {
                    "task": "Finalize Alembic migration scripts and commit baseline models",
                    "owner": "Elena (Backend Dev)",
                    "deadline": "Wednesday afternoon",
                    "timestamp_start": 48.5,
                    "timestamp_end": 58.0
                }
            ],
            open_questions_json=[
                {
                    "question": "What is the disaster recovery RPO for streaming replication in us-west-2?",
                    "raised_by": "Marcus (DevOps)",
                    "timestamp_start": 25.5,
                    "timestamp_end": 36.0
                }
            ],
            topics_json=[
                {
                    "title": "Architecture & Storage Review",
                    "summary": "Team reviewed monolith migration and pgvector benchmark results.",
                    "timestamp_start": 0.0,
                    "timestamp_end": 25.0
                },
                {
                    "title": "Disaster Recovery & Action Items",
                    "summary": "Discussed RPO requirements, WAL shipping, and Alembic migrations.",
                    "timestamp_start": 25.5,
                    "timestamp_end": 66.0
                }
            ],
            graph_type="flowchart",
            graph_json={
                "nodes": [
                    {
                        "id": "node_1",
                        "label": "Architecture Review: Monolith to Mesh",
                        "node_type": "root",
                        "timestamp_start": 0.0,
                        "timestamp_end": 7.5,
                        "speaker": "Alex (Tech Lead)"
                    },
                    {
                        "id": "node_2",
                        "label": "Benchmark pgvector vs Milvus (12ms p99)",
                        "node_type": "insight",
                        "timestamp_start": 8.0,
                        "timestamp_end": 18.2,
                        "speaker": "Elena (Backend Dev)"
                    },
                    {
                        "id": "node_3",
                        "label": "Decision: Adopt PostgreSQL 16 + pgvector",
                        "node_type": "decision",
                        "timestamp_start": 18.5,
                        "timestamp_end": 25.0,
                        "speaker": "Alex (Tech Lead)"
                    },
                    {
                        "id": "node_4",
                        "label": "DR RPO in us-west-2 Open Question",
                        "node_type": "question",
                        "timestamp_start": 25.5,
                        "timestamp_end": 36.0,
                        "speaker": "Marcus (DevOps)"
                    },
                    {
                        "id": "node_5",
                        "label": "Action: WAL Shipping & Failover Drill",
                        "node_type": "action",
                        "timestamp_start": 36.5,
                        "timestamp_end": 48.0,
                        "speaker": "Marcus (DevOps)"
                    },
                    {
                        "id": "node_6",
                        "label": "Action: Finalize Alembic Models",
                        "node_type": "action",
                        "timestamp_start": 48.5,
                        "timestamp_end": 58.0,
                        "speaker": "Elena (Backend Dev)"
                    }
                ],
                "edges": [
                    {
                        "id": "edge_1_2",
                        "source": "node_1",
                        "target": "node_2",
                        "label": "leads to"
                    },
                    {
                        "id": "edge_2_3",
                        "source": "node_2",
                        "target": "node_3",
                        "label": "justifies"
                    },
                    {
                        "id": "edge_3_4",
                        "source": "node_3",
                        "target": "node_4",
                        "label": "prompts"
                    },
                    {
                        "id": "edge_3_5",
                        "source": "node_3",
                        "target": "node_5",
                        "label": "assigns"
                    },
                    {
                        "id": "edge_3_6",
                        "source": "node_3",
                        "target": "node_6",
                        "label": "assigns"
                    }
                ]
            },
            validation_attempts=1
        )
        db.add(analysis)
        await db.commit()
        print("Sample meeting seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
