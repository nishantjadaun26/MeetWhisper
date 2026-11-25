from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, ConfigDict
from app.schemas.analysis import (
    DecisionItem,
    ActionItem,
    OpenQuestion,
    TopicSegmentItem,
    VisualGraph
)


class TranscriptSegmentResponse(BaseModel):
    id: str
    meeting_id: str
    speaker: str
    start_time: float
    end_time: float
    text: str
    confidence: Optional[float] = None
    words_json: Optional[Any] = None
    segment_order: int

    model_config = ConfigDict(from_attributes=True)


class TopicSegmentResponse(BaseModel):
    id: str
    meeting_id: str
    title: str
    summary: str
    start_time: float
    end_time: float
    segment_order: int

    model_config = ConfigDict(from_attributes=True)


class MeetingAnalysisResponse(BaseModel):
    id: str
    meeting_id: str
    executive_summary: str
    decisions_json: List[Any]
    action_items_json: List[Any]
    open_questions_json: List[Any]
    topics_json: List[Any]
    graph_type: str
    graph_json: Any
    validation_attempts: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MeetingResponse(BaseModel):
    id: str
    title: str
    filename: str
    file_size_bytes: int
    mime_type: str
    duration_seconds: float
    created_at: datetime
    updated_at: datetime
    status: Optional[str] = None
    progress_percent: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class MeetingDetailResponse(MeetingResponse):
    normalized_audio_path: Optional[str] = None
    transcript_segments: List[TranscriptSegmentResponse] = []
    topic_segments: List[TopicSegmentResponse] = []
    analysis: Optional[MeetingAnalysisResponse] = None

    model_config = ConfigDict(from_attributes=True)
