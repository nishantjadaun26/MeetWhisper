from typing import List, Optional
from pydantic import BaseModel


class SearchResultItem(BaseModel):
    meeting_id: str
    meeting_title: str
    topic_id: str
    topic_title: str
    summary: str
    start_time: float
    end_time: float
    score: float


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResultItem]
