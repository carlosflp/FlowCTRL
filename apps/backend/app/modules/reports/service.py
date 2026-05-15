from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import (
    AuditAction,
    ReportDatasetType,
    ReportExecutionStatus,
    ReportTemplateType,
)
from app.db.utils import model_to_dict
from app.modules.audit.service import create_audit_log
from app.modules.portfolios.models import Portfolio
from app.modules.portfolios.service import (
    ensure_user_has_portfolio_access,
    get_accessible_portfolio_ids,
    user_has_global_portfolio_access,
)
from app.modules.reports.definitions import (
    HIDDEN_TEMPLATE_CONFIG_KEY,
    get_report_dataset_definition,
    is_hidden_report_template,
    normalize_report_template_config,
    resolve_execution_dataset,
    resolve_report_dataset_from_config,
)
from app.modules.reports.generator import build_report_artifact
from app.modules.reports.models import ReportExecution, ReportTemplate
from app.modules.reports.schemas import (
    ReportExecutionCreate,
    ReportExecutionParameters,
    ReportTemplateCreate,
    ReportTemplateUpdate,
)
from app.modules.reports.storage import download_report_content, upload_report_content
from app.modules.users.models import User


@dataclass(frozen=True)
class ReportTemplateSpec:
    name: str
    description: str
    template_type: ReportTemplateType
    config_json: dict[str, object]
    aliases: tuple[str, ...] = ()
    create_if_missing: bool = True
    is_active: bool = True


SYSTEM_REPORT_TEMPLATE_SPECS: tuple[ReportTemplateSpec, ...] = (
    ReportTemplateSpec(
        name="Carteiras Operacionais",
        description="Base de carteiras com exportacao configuravel em CSV, XLSX ou PDF.",
        template_type=ReportTemplateType.XLSX,
        config_json={"dataset": ReportDatasetType.PORTFOLIOS.value},
    ),
    ReportTemplateSpec(
        name="Movimentacoes de Caixa",
        description="Base de movimentacoes de caixa com exportacao configuravel em CSV, XLSX ou PDF.",
        template_type=ReportTemplateType.XLSX,
        config_json={"dataset": ReportDatasetType.CASHFLOW.value},
        aliases=("Movimentacoes de Caixa PDF",),
    ),
    ReportTemplateSpec(
        name="Operacoes Consolidadas",
        description="Base consolidada das operacoes registradas na plataforma com exportacao configuravel.",
        template_type=ReportTemplateType.XLSX,
        config_json={"dataset": ReportDatasetType.OPERATIONS.value},
        aliases=("Operacoes Consolidadas XLSX", "Operacoes Consolidadas CSV"),
    ),
    ReportTemplateSpec(
        name="Precos de Ativos",
        description="Base de precificacao por ativo e fonte com exportacao configuravel em CSV, XLSX ou PDF.",
        template_type=ReportTemplateType.CSV,
        config_json={"dataset": ReportDatasetType.PRICING.value},
        aliases=("Precos de Ativos CSV",),
    ),
    ReportTemplateSpec(
        name="Relatorio Personalizado",
        description="Monte um relatorio personalizado escolhendo dataset, colunas, filtros e formato de exportacao.",
        template_type=ReportTemplateType.XLSX,
        config_json={
            "dataset": ReportDatasetType.OPERATIONS.value,
            "custom_template": True,
            "allow_custom_dataset": True,
        },
    ),
    ReportTemplateSpec(
        name="Demo - Carteiras Operacionais",
        description="Template demo para exportar a base de carteiras operacionais em qualquer formato.",
        template_type=ReportTemplateType.XLSX,
        config_json={"dataset": ReportDatasetType.PORTFOLIOS.value},
        aliases=("Demo - Carteiras Operacionais XLSX",),
        create_if_missing=False,
    ),
    ReportTemplateSpec(
        name="Demo - Operacoes Gerenciais",
        description="Template demo para analise operacional com exportacao configuravel.",
        template_type=ReportTemplateType.PDF,
        config_json={"dataset": ReportDatasetType.OPERATIONS.value},
        aliases=("Demo - Operacoes Gerenciais PDF",),
        create_if_missing=False,
    ),
)


def list_report_templates(db: Session) -> list[ReportTemplate]:
    statement = select(ReportTemplate).order_by(ReportTemplate.name.asc())
    templates = list(db.scalars(statement))
    return [template for template in templates if not is_hidden_report_template(template.config_json)]


def get_report_template_or_404(db: Session, template_id: uuid.UUID) -> ReportTemplate:
    template = db.get(ReportTemplate, template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report template not found.",
        )
    return template


def create_report_template(
    db: Session,
    payload: ReportTemplateCreate,
    *,
    actor_user_id: uuid.UUID | None = None,
) -> ReportTemplate:
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
        user_id=actor_user_id,
    )
    db.commit()
    return get_report_template_or_404(db, template.id)


def update_report_template(
    db: Session,
    template: ReportTemplate,
    payload: ReportTemplateUpdate,
    *,
    actor_user_id: uuid.UUID | None = None,
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
        user_id=actor_user_id,
    )
    db.commit()
    return get_report_template_or_404(db, template.id)


def list_report_executions(
    db: Session,
    *,
    current_user: User,
    portfolio_id: uuid.UUID | None = None,
) -> list[ReportExecution]:
    statement = (
        select(ReportExecution)
        .options(
            selectinload(ReportExecution.template),
            selectinload(ReportExecution.portfolio),
        )
        .order_by(ReportExecution.created_at.desc())
    )
    if portfolio_id is not None:
        ensure_user_has_portfolio_access(db, current_user=current_user, portfolio_id=portfolio_id)
        statement = statement.where(ReportExecution.portfolio_id == portfolio_id)
    elif not user_has_global_portfolio_access(current_user):
        accessible_portfolio_ids = get_accessible_portfolio_ids(db, current_user)
        if accessible_portfolio_ids:
            statement = statement.where(
                or_(
                    ReportExecution.portfolio_id.is_(None),
                    ReportExecution.portfolio_id.in_(accessible_portfolio_ids),
                )
            )
        else:
            statement = statement.where(ReportExecution.portfolio_id.is_(None))
    return list(db.scalars(statement))


def get_report_execution_or_404(
    db: Session,
    execution_id: uuid.UUID,
    *,
    current_user: User | None = None,
) -> ReportExecution:
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
    if current_user is not None and execution.portfolio_id is not None:
        ensure_user_has_portfolio_access(
            db,
            current_user=current_user,
            portfolio_id=execution.portfolio_id,
        )
    return execution


def create_report_execution(
    db: Session,
    payload: ReportExecutionCreate,
    *,
    current_user: User,
    actor_user_id: uuid.UUID | None = None,
) -> ReportExecution:
    template = get_report_template_or_404(db, payload.template_id)
    if not template.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inactive report templates cannot be executed.",
        )

    parameters = payload.parameters_json
    dataset = resolve_report_execution_dataset(template, parameters)
    definition = get_report_dataset_definition(dataset)
    validate_report_execution_parameters(dataset, parameters)

    allowed_portfolio_ids = (
        None
        if user_has_global_portfolio_access(current_user)
        else get_accessible_portfolio_ids(db, current_user)
    )
    if payload.portfolio_id is not None:
        if not definition.supports_portfolio_scope:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Portfolio scope is not supported for the {dataset.value} dataset.",
            )
        ensure_user_has_portfolio_access(
            db,
            current_user=current_user,
            portfolio_id=payload.portfolio_id,
        )

    file_type = (payload.file_type or template.template_type).value
    execution = ReportExecution(
        template_id=payload.template_id,
        portfolio_id=payload.portfolio_id,
        parameters_json=serialize_report_execution_parameters(
            parameters,
            allowed_portfolio_ids=allowed_portfolio_ids,
        ),
        status=ReportExecutionStatus.QUEUED,
        file_type=file_type,
    )
    db.add(execution)
    db.flush()
    create_audit_log(
        db,
        entity_type="report_execution",
        entity_id=str(execution.id),
        action=AuditAction.CREATED,
        new_value=model_to_dict(execution),
        user_id=actor_user_id,
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

    return get_report_execution_or_404(db, execution.id, current_user=current_user)


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
    *,
    current_user: User,
) -> tuple[str, str, bytes]:
    execution = get_report_execution_or_404(db, execution_id, current_user=current_user)
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
    templates = list(db.scalars(select(ReportTemplate).order_by(ReportTemplate.created_at.asc())))
    templates_by_name = {template.name: template for template in templates}
    changed = False

    for spec in SYSTEM_REPORT_TEMPLATE_SPECS:
        changed = sync_report_template_spec(db, spec, templates_by_name) or changed

    if changed:
        db.commit()


def sync_report_template_spec(
    db: Session,
    spec: ReportTemplateSpec,
    templates_by_name: dict[str, ReportTemplate],
) -> bool:
    canonical = templates_by_name.get(spec.name)
    aliases = [templates_by_name[name] for name in spec.aliases if name in templates_by_name]
    primary = select_primary_report_template(spec, canonical, aliases)
    changed = False

    if primary is None:
        if not spec.create_if_missing:
            return False

        primary = ReportTemplate(
            name=spec.name,
            description=spec.description,
            template_type=spec.template_type,
            config_json=dict(spec.config_json),
            is_active=spec.is_active,
        )
        db.add(primary)
        db.flush()
        templates_by_name[spec.name] = primary
        changed = True
    else:
        if primary.name != spec.name and spec.name not in templates_by_name:
            del templates_by_name[primary.name]
            primary.name = spec.name
            templates_by_name[spec.name] = primary
            changed = True

        changed = apply_report_template_spec(primary, spec, preserve_active=canonical is not None) or changed

    duplicate_templates = [
        template
        for template in aliases
        if template.id != primary.id
    ]

    if canonical is not None and canonical.id != primary.id:
        duplicate_templates.append(canonical)

    for duplicate in duplicate_templates:
        changed = hide_report_template(duplicate) or changed

    return changed


def select_primary_report_template(
    spec: ReportTemplateSpec,
    canonical: ReportTemplate | None,
    aliases: list[ReportTemplate],
) -> ReportTemplate | None:
    if canonical is not None:
        return canonical

    visible_aliases = [template for template in aliases if not is_hidden_report_template(template.config_json)]
    candidates = visible_aliases or aliases
    if not candidates:
        return None

    for candidate in candidates:
        if candidate.template_type == spec.template_type:
            return candidate
    return candidates[0]


def apply_report_template_spec(
    template: ReportTemplate,
    spec: ReportTemplateSpec,
    *,
    preserve_active: bool,
) -> bool:
    changed = False
    desired_config = dict(spec.config_json)
    raw_current_config = normalize_report_template_config(template.config_json)
    current_config = dict(raw_current_config)
    current_config.pop(HIDDEN_TEMPLATE_CONFIG_KEY, None)

    if template.description != spec.description:
        template.description = spec.description
        changed = True
    if template.template_type != spec.template_type:
        template.template_type = spec.template_type
        changed = True
    if current_config != desired_config or raw_current_config.get(HIDDEN_TEMPLATE_CONFIG_KEY):
        template.config_json = desired_config
        changed = True
    if not preserve_active and template.is_active != spec.is_active:
        template.is_active = spec.is_active
        changed = True

    if changed:
        db_safe_add(template)
    return changed


def hide_report_template(template: ReportTemplate) -> bool:
    changed = False
    config = normalize_report_template_config(template.config_json)

    if not config.get(HIDDEN_TEMPLATE_CONFIG_KEY):
        config[HIDDEN_TEMPLATE_CONFIG_KEY] = True
        template.config_json = config
        changed = True
    if template.is_active:
        template.is_active = False
        changed = True

    if changed:
        db_safe_add(template)
    return changed


def db_safe_add(model) -> None:
    from sqlalchemy.orm.session import object_session

    session = object_session(model)
    if session is not None:
        session.add(model)


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
    try:
        resolve_report_dataset_from_config(config_json)
    except ValueError as exc:
        allowed = ", ".join(dataset_type.value for dataset_type in ReportDatasetType)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Invalid report dataset. Allowed values: {allowed}.",
        ) from exc


def resolve_report_dataset(template: ReportTemplate) -> ReportDatasetType:
    return resolve_report_dataset_from_config(template.config_json)


def resolve_report_execution_dataset(
    template: ReportTemplate,
    parameters: ReportExecutionParameters | None,
) -> ReportDatasetType:
    try:
        return resolve_execution_dataset(
            template.config_json,
            parameters.dataset if parameters else None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


def validate_report_execution_parameters(
    dataset: ReportDatasetType,
    parameters: ReportExecutionParameters | None,
) -> None:
    if parameters is None:
        return

    definition = get_report_dataset_definition(dataset)
    if (parameters.date_from or parameters.date_to) and definition.date_field is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Date range filters are not supported for the {dataset.value} dataset.",
        )

    if parameters.columns:
        invalid_columns = [column for column in parameters.columns if column not in definition.columns]
        if invalid_columns:
            allowed_columns = ", ".join(definition.columns)
            invalid_columns_text = ", ".join(invalid_columns)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    f"Invalid report columns for the {dataset.value} dataset: {invalid_columns_text}. "
                    f"Allowed columns: {allowed_columns}."
                ),
            )


def serialize_report_execution_parameters(
    parameters: ReportExecutionParameters | None,
    *,
    allowed_portfolio_ids: list[uuid.UUID] | None = None,
) -> dict | None:
    if parameters is None:
        if not allowed_portfolio_ids:
            return None
        return {"allowed_portfolio_ids": [str(portfolio_id) for portfolio_id in allowed_portfolio_ids]}

    serialized = parameters.model_dump(mode="json", exclude_none=True)
    if allowed_portfolio_ids:
        serialized["allowed_portfolio_ids"] = [str(portfolio_id) for portfolio_id in allowed_portfolio_ids]
    return serialized or None


def build_report_object_name(execution: ReportExecution, template_name: str, file_type: str) -> str:
    return f"reports/{execution.id}-{slugify(template_name)}.{file_type}"


def build_report_filename(template_name: str, execution_id: uuid.UUID, file_type: str) -> str:
    return f"{slugify(template_name)}-{execution_id}.{file_type}"


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return normalized.strip("-") or "report"
