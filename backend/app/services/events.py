import asyncio
import json
import logging
from typing import Dict, Set, AsyncGenerator, Optional
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class JobEventBroadcaster:
    """
    Manages SSE channels for real-time job progress streaming.
    Supports in-memory asyncio queues and Redis pub/sub.
    """
    def __init__(self):
        self._listeners: Dict[str, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, job_id: str) -> AsyncGenerator[str, None]:
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            if job_id not in self._listeners:
                self._listeners[job_id] = set()
            self._listeners[job_id].add(queue)

        try:
            while True:
                # Wait for next event or send ping after 15 seconds
                try:
                    event_data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"event: progress\ndata: {json.dumps(event_data)}\n\n"
                    if event_data.get("status") in ("completed", "failed"):
                        break
                except asyncio.TimeoutError:
                    # Keep-alive comment
                    yield ": ping\n\n"
        finally:
            async with self._lock:
                if job_id in self._listeners:
                    self._listeners[job_id].discard(queue)
                    if not self._listeners[job_id]:
                        del self._listeners[job_id]

    async def broadcast(self, job_id: str, status: str, progress_percent: int, stage_message: str, error: Optional[str] = None):
        payload = {
            "job_id": job_id,
            "status": status,
            "progress_percent": progress_percent,
            "stage_message": stage_message,
            "error_message": error,
        }

        # In-memory queues
        async with self._lock:
            queues = list(self._listeners.get(job_id, []))

        for q in queues:
            await q.put(payload)


job_broadcaster = JobEventBroadcaster()
