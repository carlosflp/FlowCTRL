import uuid

from app.modules.reports.service import process_report_execution
from app.workers.celery_app import celery_app


@celery_app.task(name="health.ping")
def ping() -> dict[str, str]:
    return {"status": "pong"}


@celery_app.task(name="reports.generate_execution")
def generate_report_execution_task(execution_id: str) -> None:
    process_report_execution(uuid.UUID(execution_id))
