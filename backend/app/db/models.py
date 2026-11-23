import uuid
from datetime import datetime, timezone
from typing import Optional, List, Any
from sqlalchemy import (
    String, Text, Float, Integer, ForeignKey, DateTime, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, VectorType


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    normalized_audio_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="meeting", cascade="all, delete-orphan")
    transcript_segments: Mapped[List["TranscriptSegment"]] = relationship(
        "TranscriptSegment",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="TranscriptSegment.segment_order"
    )
    analysis: Mapped[Optional["MeetingAnalysis"]] = relationship(
        "MeetingAnalysis",
        back_populates="meeting",
        uselist=False,
        cascade="all, delete-orphan"
    )
    topic_segments: Mapped[List["TopicSegment"]] = relationship(
        "TopicSegment",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="TopicSegment.segment_order"
    )


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    
    # queued -> normalizing -> transcribing -> chunking -> extracting_graph -> completed | failed
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="queued")
    progress_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stage_message: Mapped[str] = mapped_column(String(255), nullable=False, default="Job queued")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="jobs")


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    speaker: Mapped[str] = mapped_column(String(50), nullable=False, default="Speaker 1")
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    words_json: Mapped[Optional[Any]] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    segment_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="transcript_segments")

    __table_args__ = (
        Index("idx_transcript_segments_meeting_order", "meeting_id", "segment_order"),
    )


class MeetingAnalysis(Base):
    __tablename__ = "meeting_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    executive_summary: Mapped[str] = mapped_column(Text, nullable=False)
    decisions_json: Mapped[Any] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False, default=list)
    action_items_json: Mapped[Any] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False, default=list)
    open_questions_json: Mapped[Any] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False, default=list)
    topics_json: Mapped[Any] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False, default=list)
    
    graph_type: Mapped[str] = mapped_column(String(20), nullable=False, default="flowchart")  # flowchart | mindmap
    graph_json: Mapped[Any] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False, default=dict)
    
    raw_llm_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    validation_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="analysis")


class TopicSegment(Base):
    __tablename__ = "topic_segments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    segment_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    embedding: Mapped[Optional[List[float]]] = mapped_column(VectorType(dim=384), nullable=True)

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="topic_segments")

    __table_args__ = (
        Index("idx_topic_segments_meeting_order", "meeting_id", "segment_order"),
    )
