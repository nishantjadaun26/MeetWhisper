from typing import List, Optional
from pydantic import BaseModel, Field


class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float
    probability: Optional[float] = None


class SegmentResult(BaseModel):
    speaker: str
    start_time: float
    end_time: float
    text: str
    confidence: Optional[float] = None
    words: Optional[List[WordTimestamp]] = None


class TranscriptResult(BaseModel):
    text: str
    language: str = "en"
    duration: float = 0.0
    segments: List[SegmentResult] = Field(default_factory=list)


class TopicChunk(BaseModel):
    title: str
    summary: str
    start_time: float
    end_time: float
    segment_indices: List[int] = Field(default_factory=list)
    embedding: Optional[List[float]] = None
