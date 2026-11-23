import asyncio
import logging
from app.worker.celery_app import celery
from app.worker.pipeline import execute_processing_pipeline

logger = logging.getLogger(__name__)


@celery.task(bind=True, name="process_meeting_task")
def process_meeting_task(self, job_id: str, meeting_id: str):
    logger.info("Starting celery background task for job %s, meeting %s", job_id, meeting_id)
    try:
        asyncio.run(execute_processing_pipeline(job_id, meeting_id))
        return {"status": "success", "job_id": job_id}
    except Exception as e:
        logger.exception("Celery task execution failed: %s", e)
        raise e
