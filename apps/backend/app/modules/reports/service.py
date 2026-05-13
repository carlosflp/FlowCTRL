from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import AuditAction, ReportDatasetType, ReportExecutionStatus
from app.db.utils import model_to_dict
from app.modules.audit.service import create_audit_log
from app.modules.portfolios.models import Portfolio
from app.modules.reports.generator import build_report_artifact
from app.modules.reports.models import ReportExecution, ReportTemplate
from app.modules.reports.schemas import (
    ReportExecutionCreate,
    ReportTemplateCreate,
    ReportTemplateUpdate,
)
from app.modules.reports.storage import download_report_content, upload_report_content

DEFAULT_REPORT_TEMPLATES = [
    {
        "name": "Operacoes Consolidadas CSV",
        "description": "Extracao consolidada das operacoes registradas na plataforma.",
        "template_type": "csv",
        "config_json": {"dataset": "operations"},
    },
    {
        "name": "Operacoes Consolidadas XLSX",
        "description": "Versao em planilha das operacoes para analise operacional.",
        "template_type": "xlsx",
        "config_json": {"dataset": "operations"},
    },
    {
        "name": "Movimentacoes de Caixa PDF",
        "description": "Resumo em PDF das movimentacoes de caixa registradas.",
        "template_type": "pdf",
        "config_json": {"dataset": "cashflow"},
    },
    {
        "name": "Precos de Ativos CSV",
        "description": "Exportacao da base de precificacao por ativo e fonte.",
        "template_type": "csv",
        "config_json": {"dataset": "pricing"},
    },
]


def list_report_templates(db: Session) -> list[ReportTemplate]:
    statement = select(ReportTemplate).order_by(ReportTemplate.name.asc())
    return list(db.scalars(statement))


def get_report_template_or_404(db: Session, template_id: uuid.UUID) -> ReportTemplate:
    template = db.get(ReportTemplate, template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report template not found.",
        )
    return template


def create_report_template(db: Session, payload: ReportTemplateCreate) -> ReportTemplate:
    ensure_template_name_is_available(db, payload.name)
    validate_report_template_config(payload.config_json)

    template = ReportTemplate(**payload.model_dump())
    db.add(template)
    db.flush()
    create_audit_log(
        db,
        entity_type="report_template",
        entity_id=str(template.id),
        action=AuditAction.CREATED,
        new_value=model_to_dict(template),
    )
    db.commit()
    return get_report_template_or_404(db, template.id)


def update_report_template(
    db: Session,
    template: ReportTemplate,
    payload: ReportTemplateUpdate,
) -> ReportTemplate:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return template

    if "name" in updates and updates["name"] != template.name:
        ensure_template_name_is_available(db, updates["name"], ignore_id=template.id)

    config_json = updates.get("config_json", template.config_json)
    validate_report_template_config(config_json)

    old_value = model_to_dict(template)
    for field, value in updates.items():
        setattr(template, field, value)

    db.add(template)
    db.flush()
    create_audit_log(
        db,
        entity_type="report_template",
        entity_id=str(template.id),
        action=AuditAction.UPDATED,
        old_value=old_value,
        new_value=model_to_dict(template),
    )
    db.commit()
    return get_report_template_or_404(db, template.id)


def list_report_executions(db: Session) -> list[ReportExecution]:
    statement = (
        select(ReportExecution)
        .options(
            selectinload(ReportExecution.template),
            selectinload(ReportExecution.portfolio),
        )
        .order_by(ReportExecution.created_at.desc())
    )
    return list(db.scalars(statement))


def get_report_execution_or_404(db: Session, execution_id: uuid.UUID) -> ReportExecution:
    statement = (
        select(ReportExecution)
        .where(ReportExecution.id == execution_id)
        .options(
            selectinload(ReportExecution.template),
            selectinload(ReportExecution.portfolio),
        )
    )
    execution = db.scalar(statement)
    if execution is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report execution not found.",
        )
    return execution


def create_report_execution(db: Session, payload: ReportExecutionCreate) -> ReportExecution:
    template = get_report_template_or_404(db, payload.template_id)
    if not template.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inactive report templates cannot be executed.",
        )

    if payload.portfolio_id is not None:
        ensure_portfolio_exists(db, payload.portfolio_id)

    execution = ReportExecution(
        template_id=payload.template_id,
        portfolio_id=payload.portfolio_id,
        parameters_json=payload.parameters_json,
        status=ReportExecutionStatus.QUEUED,
    )
    db.add(execution)
    db.flush()
    create_audit_log(
        db,
        entity_type="report_execution",
        entity_id=str(execution.id),
        action=AuditAction.CREATED,
        new_value=model_to_dict(execution),
    )
    db.commit()

    try:
        queue_report_execution(execution.id)
    except Exception as exc:  # pragma: no cover - defensive path
        execution = get_report_execution_or_404(db, execution.id)
        execution.status = ReportExecutionStatus.FAILED
        execution.finished_at = datetime.now(UTC)
        db.add(execution)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue the report execution.",
        ) from exc

    return get_report_execution_or_404(db, execution.id)


def queue_report_execution(execution_id: uuid.UUID) -> None:
    from app.workers.tasks import generate_report_execution_task

    generate_report_execution_task.delay(str(execution_id))


def process_report_execution(execution_id: uuid.UUID) -> None:
    from app.db.session import get_session_factory

    db = get_session_factory()()
    try:
        process_report_execution_in_session(db, execution_id)
    finally:
        db.close()


def process_report_execution_in_session(db: Session, execution_id: uuid.UUID) -> None:
    try:
        execution = get_report_execution_or_404(db, execution_id)
        execution.status = ReportExecutionStatus.RUNNING
        execution.finished_at = None
        db.add(execution)
        db.commit()

        execution = get_report_execution_or_404(db, execution_id)
        artifact = build_report_artifact(db, execution, execution.template)
        object_name = build_report_object_name(
            execution,
            execution.template.name,
            artifact.file_type,
        )
        upload_report_content(
            object_name=object_name,
            content=artifact.content,
            file_type=artifact.file_type,
        )

        execution.status = ReportExecutionStatus.COMPLETED
        execution.file_path = object_name
        execution.file_type = artifact.file_type
        execution.finished_at = datetime.now(UTC)
        db.add(execution)
        db.commit()
    except Exception:
        execution = get_report_execution_or_404(db, execution_id)
        execution.status = ReportExecutionStatus.FAILED
        execution.finished_at = datetime.now(UTC)
        db.add(execution)
        db.commit()
        raise


def get_report_download_payload(
    db: Session,
    execution_id: uuid.UUID,
) -> tuple[str, str, bytes]:
    execution = get_report_execution_or_404(db, execution_id)
    if (
        execution.status != ReportExecutionStatus.COMPLETED
        or not execution.file_path
        or not execution.file_type
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The selected report execution does not have a downloadable artifact yet.",
        )

    content = download_report_content(execution.file_path)
    filename = build_report_filename(execution.template.name, execution.id, execution.file_type)
    return filename, execution.file_type, content


def ensure_default_report_templates(db: Session) -> None:
    existing_names = set(db.scalars(select(ReportTemplate.name)))
    created_any = False

    for template_data in DEFAULT_REPORT_TEMPLATES:
        if template_data["name"] in existing_names:
            continue
        db.add(ReportTemplate(**template_data))
        created_any = True

    if created_any:
        db.commit()


def ensure_portfolio_exists(db: Session, portfolio_id: uuid.UUID) -> None:
    if db.get(Portfolio, portfolio_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found.")


def ensure_template_name_is_available(
    db: Session,
    name: str,
    *,
    ignore_id: uuid.UUID | None = None,
) -> None:
    statement = select(ReportTemplate).where(ReportTemplate.name == name)
    existing = db.scalar(statement)
    if existing is None:
        return
    if ignore_id is not None and existing.id == ignore_id:
        return
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="A report template with the same name already exists.",
    )


def validate_report_template_config(config_json: dict | None) -> None:
    config = config_json or {}
    dataset = config.get("dataset", ReportDatasetType.OPERATIONS.value)
    try:
        ReportDatasetType(dataset)
    except ValueError as exc:
        allowed = ", ".join(dataset_type.value for dataset_type in ReportDatasetType)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Invalid report dataset. Allowed values: {allowed}.",
        ) from exc


def build_report_object_name(execution: ReportExecution, template_name: str, file_type: str) -> str:
    return f"reports/{execution.id}-{slugify(template_name)}.{file_type}"


def build_report_filename(template_name: str, execution_id: uuid.UUID, file_type: str) -> str:
    return f"{slugify(template_name)}-{execution_id}.{file_type}"


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return normalized.strip("-") or "report"
