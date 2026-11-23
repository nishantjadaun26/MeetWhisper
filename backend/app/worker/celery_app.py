from app.config import get_settings

settings = get_settings()

try:
    from celery import Celery

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
except ImportError:
    # Graceful fallback when celery is not installed in local environment
    class MockCelery:
        def task(self, *args, **kwargs):
            def decorator(fn):
                fn.delay = fn
                return fn
            return decorator

    celery = MockCelery()
