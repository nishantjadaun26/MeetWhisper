import logging
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.db.models import TopicSegment, Meeting
from app.schemas.search import SearchResponse, SearchResultItem

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=SearchResponse)
async def search_topics(
    q: str = Query(..., min_length=1, description="Semantic or keyword search query"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    query_str = q.strip()
    results: List[SearchResultItem] = []

    # Try embedding-based semantic search first if sentence-transformers is available
    query_embedding = None
    try:
        from app.ml.chunker import get_text_embedding
        query_embedding = get_text_embedding(query_str)
    except Exception as e:
        logger.debug("Embedding extraction not available for search: %s", e)

    # 1. Check if dialect is postgresql and pgvector is supported
    bind = db.bind
    is_postgres = bind is not None and bind.dialect.name == "postgresql"

    if is_postgres and query_embedding is not None:
        try:
            # pgvector cosine distance: embedding <=> query_embedding
            stmt = (
                select(
                    TopicSegment,
                    Meeting,
                    TopicSegment.embedding.cosine_distance(query_embedding).label("distance")
                )
                .join(Meeting, TopicSegment.meeting_id == Meeting.id)
                .where(TopicSegment.embedding.isnot(None))
                .order_by("distance")
                .limit(limit)
            )
            res = await db.execute(stmt)
            for topic, meeting, dist in res.all():
                score = max(0.0, 1.0 - float(dist)) if dist is not None else 0.5
                results.append(
                    SearchResultItem(
                        meeting_id=meeting.id,
                        meeting_title=meeting.title,
                        topic_id=topic.id,
                        topic_title=topic.title,
                        summary=topic.summary,
                        start_time=topic.start_time,
                        end_time=topic.end_time,
                        score=round(score, 4)
                    )
                )
            if results:
                return SearchResponse(query=query_str, results=results)
        except Exception as e:
            logger.warning("Vector query failed, falling back to text match: %s", e)

    # 2. Text / ILIKE Fallback (works across SQLite & PostgreSQL)
    pattern = f"%{query_str}%"
    stmt = (
        select(TopicSegment, Meeting)
        .join(Meeting, TopicSegment.meeting_id == Meeting.id)
        .where(
            or_(
                TopicSegment.title.ilike(pattern),
                TopicSegment.summary.ilike(pattern),
                Meeting.title.ilike(pattern)
            )
        )
        .limit(limit)
    )
    res = await db.execute(stmt)
    for topic, meeting in res.all():
        results.append(
            SearchResultItem(
                meeting_id=meeting.id,
                meeting_title=meeting.title,
                topic_id=topic.id,
                topic_title=topic.title,
                summary=topic.summary,
                start_time=topic.start_time,
                end_time=topic.end_time,
                score=0.95
            )
        )

    return SearchResponse(query=query_str, results=results)
