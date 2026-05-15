from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
import uuid

from fastapi import HTTPException, UploadFile, status
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import (
    AuditAction,
    ImportDatasetType,
    ImportJobStatus,
    ImportSourceType,
)
from app.db.utils import model_to_dict
from app.modules.assets.models import Asset
from app.modules.audit.service import create_audit_log
from app.modules.cashflow.schemas import CashflowEntryCreate
from app.modules.cashflow.service import create_cashflow_entry
from app.modules.imports.models import ImportJob
from app.modules.imports.parser import (
    extract_value,
    get_aliases_for_dataset,
    get_file_type,
    get_preview_rows,
    load_import_dataframe,
    parse_boolean,
    parse_date_string,
    parse_decimal,
    parse_string,
)
from app.modules.imports.storage import download_import_content, upload_import_content
from app.modules.operations.schemas import OperationCreate
from app.modules.operations.service import create_operation
from app.modules.portfolios.service import (
    ensure_user_has_portfolio_access,
    get_accessible_portfolio_ids,
    user_has_global_portfolio_access,
)
from app.modules.pricing.schemas import AssetPriceCreate
from app.modules.pricing.service import create_asset_price
from app.modules.users.models import User


def list_import_jobs(
    db: Session,
    *,
    current_user: User,
    portfolio_id: uuid.UUID | None = None,
) -> list[ImportJob]:
    statement = (
        select(ImportJob)
        .options(
            selectinload(ImportJob.portfolio),
            selectinload(ImportJob.created_by_user),
        )
        .order_by(ImportJob.created_at.desc())
    )

    if portfolio_id is not None:
        ensure_user_has_portfolio_access(db, current_user=current_user, portfolio_id=portfolio_id)
        statement = statement.where(ImportJob.portfolio_id == portfolio_id)
    elif not user_has_global_portfolio_access(current_user):
        accessible_portfolio_ids = get_accessible_portfolio_ids(db, current_user)
        if not accessible_portfolio_ids:
            return []
        statement = statement.where(ImportJob.portfolio_id.in_(accessible_portfolio_ids))

    return list(db.scalars(statement))


def get_import_job_or_404(
    db: Session,
    job_id: uuid.UUID,
    *,
    current_user: User | None = None,
) -> ImportJob:
    statement = (
        select(ImportJob)
        .where(ImportJob.id == job_id)
        .options(
            selectinload(ImportJob.portfolio),
            selectinload(ImportJob.created_by_user),
        )
    )
    job = db.scalar(statement)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import job not found.")
    if current_user is not None:
        ensure_user_has_portfolio_access(db, current_user=current_user, portfolio_id=job.portfolio_id)
    return job


def build_import_object_name(job_id: uuid.UUID, file_name: str) -> str:
    sanitized_name = Path(file_name).name.replace(" ", "_")
    return f"imports/{job_id}/{sanitized_name}"


def queue_import_job(job_id: uuid.UUID) -> None:
    from app.workers.tasks import process_import_job_task

    process_import_job_task.delay(str(job_id))


def create_import_job(
    db: Session,
    *,
    file: UploadFile,
    dataset: ImportDatasetType,
    source: ImportSourceType,
    portfolio_id: uuid.UUID,
    current_user: User,
) -> ImportJob:
    ensure_user_has_portfolio_access(db, current_user=current_user, portfolio_id=portfolio_id)

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An import file is required.")

    try:
        file_type = get_file_type(file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc

    content = file.file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty.")

    try:
        dataframe = load_import_dataframe(content, file_type)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The uploaded file could not be parsed as CSV or XLSX.",
        ) from exc

    job_id = uuid.uuid4()
    object_name = build_import_object_name(job_id, file.filename)
    upload_import_content(object_name=object_name, content=content, file_type=file_type)

    job = ImportJob(
        id=job_id,
        portfolio_id=portfolio_id,
        created_by_user_id=current_user.id,
        dataset=dataset,
        source=source,
        status=ImportJobStatus.QUEUED,
        file_name=file.filename,
        file_type=file_type,
        storage_path=object_name,
        preview_rows_json=get_preview_rows(dataframe),
        result_json=None,
        total_rows=len(dataframe.index),
        processed_rows=0,
        successful_rows=0,
        failed_rows=0,
    )
    db.add(job)
    db.flush()
    create_audit_log(
        db,
        entity_type="import_job",
        entity_id=str(job.id),
        action=AuditAction.CREATED,
        new_value=model_to_dict(job),
        user_id=current_user.id,
    )
    db.commit()

    try:
        queue_import_job(job.id)
    except Exception as exc:  # pragma: no cover - defensive path
        job = get_import_job_or_404(db, job.id)
        job.status = ImportJobStatus.FAILED
        job.finished_at = datetime.now(UTC)
        job.result_json = {"summary": "Failed to queue the import job."}
        db.add(job)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue the import job.",
        ) from exc

    return get_import_job_or_404(db, job.id, current_user=current_user)


def process_import_job(job_id: uuid.UUID) -> None:
    from app.db.session import get_session_factory

    db = get_session_factory()()
    try:
        process_import_job_in_session(db, job_id)
    finally:
        db.close()


def _resolve_asset_id_by_ticker(db: Session, ticker: str) -> uuid.UUID:
    asset_id = db.scalar(select(Asset.id).where(func.lower(Asset.ticker) == ticker.lower()))
    if asset_id is None:
        raise ValueError(f"Asset '{ticker}' was not found.")
    return asset_id


def _build_operation_payload(db: Session, row: dict[str, object | None], portfolio_id: uuid.UUID) -> OperationCreate:
    aliases = get_aliases_for_dataset(ImportDatasetType.OPERATIONS)
    trade_date = parse_date_string(extract_value(row, aliases["trade_date"]), field_name="trade_date")
    settlement_date = parse_date_string(
        extract_value(row, aliases["settlement_date"]),
        field_name="settlement_date",
        required=False,
        default=trade_date,
    )
    return OperationCreate(
        portfolio_id=portfolio_id,
        asset_id=_resolve_asset_id_by_ticker(
            db=db,
            ticker=parse_string(extract_value(row, aliases["asset_ticker"]), field_name="asset_ticker"),
        ),
        operation_type=parse_string(extract_value(row, aliases["operation_type"]), field_name="operation_type"),
        trade_date=trade_date,
        settlement_date=settlement_date,
        quantity=parse_decimal(extract_value(row, aliases["quantity"]), field_name="quantity"),
        unit_price=parse_decimal(extract_value(row, aliases["unit_price"]), field_name="unit_price"),
        gross_value=parse_decimal(
            extract_value(row, aliases["gross_value"]),
            field_name="gross_value",
            required=False,
        ),
        net_value=parse_decimal(
            extract_value(row, aliases["net_value"]),
            field_name="net_value",
            required=False,
        ),
        fees=parse_decimal(
            extract_value(row, aliases["fees"]),
            field_name="fees",
            required=False,
            default="0",
        ),
        taxes=parse_decimal(
            extract_value(row, aliases["taxes"]),
            field_name="taxes",
            required=False,
            default="0",
        ),
        status=parse_string(
            extract_value(row, aliases["status"]),
            field_name="status",
            required=False,
        )
        or "approved",
        notes=parse_string(extract_value(row, aliases["notes"]), field_name="notes", required=False),
    )


def _build_cashflow_payload(row: dict[str, object | None], portfolio_id: uuid.UUID) -> CashflowEntryCreate:
    aliases = get_aliases_for_dataset(ImportDatasetType.CASHFLOW)
    entry_date = parse_date_string(extract_value(row, aliases["entry_date"]), field_name="entry_date")
    settlement_date = parse_date_string(
        extract_value(row, aliases["settlement_date"]),
        field_name="settlement_date",
        required=False,
        default=entry_date,
    )
    return CashflowEntryCreate(
        portfolio_id=portfolio_id,
        operation_id=None,
        entry_date=entry_date,
        settlement_date=settlement_date,
        description=parse_string(extract_value(row, aliases["description"]), field_name="description"),
        entry_type=parse_string(extract_value(row, aliases["entry_type"]), field_name="entry_type"),
        amount=parse_decimal(extract_value(row, aliases["amount"]), field_name="amount"),
        status=parse_string(extract_value(row, aliases["status"]), field_name="status", required=False) or "settled",
    )


def _build_pricing_payload(db: Session, row: dict[str, object | None]) -> AssetPriceCreate:
    aliases = get_aliases_for_dataset(ImportDatasetType.PRICING)
    return AssetPriceCreate(
        asset_id=_resolve_asset_id_by_ticker(
            db=db,
            ticker=parse_string(extract_value(row, aliases["asset_ticker"]), field_name="asset_ticker"),
        ),
        price_date=parse_date_string(extract_value(row, aliases["price_date"]), field_name="price_date"),
        price=parse_decimal(extract_value(row, aliases["price"]), field_name="price"),
        source=parse_string(extract_value(row, aliases["source"]), field_name="source", required=False) or "imported",
        is_validated=parse_boolean(extract_value(row, aliases["is_validated"]), default=False),
    )


def process_import_job_in_session(db: Session, job_id: uuid.UUID) -> None:
    job = get_import_job_or_404(db, job_id)
    previous_job_state = model_to_dict(job)
    job.status = ImportJobStatus.PROCESSING
    job.started_at = datetime.now(UTC)
    job.finished_at = None
    job.result_json = None
    db.add(job)
    db.commit()

    current_user = db.get(User, job.created_by_user_id) if job.created_by_user_id else None
    if current_user is None:
        job = get_import_job_or_404(db, job_id)
        job.status = ImportJobStatus.FAILED
        job.finished_at = datetime.now(UTC)
        job.result_json = {"summary": "The user responsible for this import was not found."}
        db.add(job)
        db.commit()
        return

    try:
        content = download_import_content(job.storage_path)
        dataframe = load_import_dataframe(content, job.file_type)
    except Exception:
        job = get_import_job_or_404(db, job_id)
        job.status = ImportJobStatus.FAILED
        job.finished_at = datetime.now(UTC)
        job.result_json = {"summary": "The uploaded file could not be reloaded for processing."}
        db.add(job)
        db.commit()
        raise

    try:
        errors: list[dict[str, object]] = []
        successful_rows = 0
        processed_rows = 0

        for row_index, record in enumerate(dataframe.to_dict(orient="records"), start=2):
            processed_rows += 1
            row = dict(record)
            try:
                if job.dataset is ImportDatasetType.OPERATIONS:
                    payload = _build_operation_payload(db, row, job.portfolio_id)
                    create_operation(
                        db,
                        payload,
                        current_user=current_user,
                        actor_user_id=current_user.id,
                    )
                elif job.dataset is ImportDatasetType.CASHFLOW:
                    payload = _build_cashflow_payload(row, job.portfolio_id)
                    create_cashflow_entry(
                        db,
                        payload,
                        current_user=current_user,
                        actor_user_id=current_user.id,
                    )
                else:
                    payload = _build_pricing_payload(db, row)
                    create_asset_price(db, payload, actor_user_id=current_user.id)
                successful_rows += 1
            except (HTTPException, ValidationError, ValueError) as exc:
                message = exc.detail if isinstance(exc, HTTPException) else str(exc)
                errors.append(
                    {
                        "row_number": row_index,
                        "message": message,
                        "row_preview": row,
                    }
                )

        job = get_import_job_or_404(db, job_id)
        job.total_rows = len(dataframe.index)
        job.processed_rows = processed_rows
        job.successful_rows = successful_rows
        job.failed_rows = len(errors)
        job.finished_at = datetime.now(UTC)
        job.result_json = {
            "summary": f"{successful_rows} row(s) imported, {len(errors)} row(s) with errors.",
            "errors": errors[:25],
        }
        job.status = (
            ImportJobStatus.COMPLETED
            if not errors
            else ImportJobStatus.COMPLETED_WITH_ERRORS
        )
        db.add(job)
        create_audit_log(
            db,
            entity_type="import_job",
            entity_id=str(job.id),
            action=AuditAction.UPDATED,
            old_value=previous_job_state,
            new_value=model_to_dict(job),
            user_id=current_user.id,
        )
        db.commit()
    except Exception:
        job = get_import_job_or_404(db, job_id)
        job.status = ImportJobStatus.FAILED
        job.finished_at = datetime.now(UTC)
        job.result_json = {"summary": "The import job failed unexpectedly during processing."}
        db.add(job)
        db.commit()
        raise
