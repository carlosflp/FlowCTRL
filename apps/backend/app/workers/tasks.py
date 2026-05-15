import uuid

from app.modules.imports.service import process_import_job
from app.modules.reports.service import process_report_execution
from app.workers.celery_app import celery_app


@celery_app.task(name="health.ping")
def ping() -> dict[str, str]:
    return {"status": "pong"}


@celery_app.task(name="reports.generate_execution")
def generate_report_execution_task(execution_id: str) -> None:
    process_report_execution(uuid.UUID(execution_id))


@celery_app.task(name="imports.process_job")
def process_import_job_task(job_id: str) -> None:
    process_import_job(uuid.UUID(job_id))
