from celery import Celery
from app.config import get_settings

settings = get_settings()

celery = Celery(
    "meetwhisper_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
