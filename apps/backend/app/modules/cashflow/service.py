import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import AuditAction
from app.db.utils import model_to_dict
from app.modules.audit.service import create_audit_log
from app.modules.cashflow.models import CashflowEntry
from app.modules.cashflow.schemas import CashflowEntryCreate, CashflowEntryUpdate
from app.modules.operations.models import Operation
from app.modules.portfolios.models import Portfolio


def list_cashflow_entries(db: Session) -> list[CashflowEntry]:
    statement = (
        select(CashflowEntry)
        .options(
            selectinload(CashflowEntry.portfolio),
            selectinload(CashflowEntry.operation),
        )
        .order_by(CashflowEntry.settlement_date.desc(), CashflowEntry.created_at.desc())
    )
    return list(db.scalars(statement))


def get_cashflow_entry_or_404(db: Session, entry_id: uuid.UUID) -> CashflowEntry:
    statement = (
        select(CashflowEntry)
        .where(CashflowEntry.id == entry_id)
        .options(
            selectinload(CashflowEntry.portfolio),
            selectinload(CashflowEntry.operation),
        )
    )
    entry = db.scalar(statement)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cashflow entry not found.",
        )
    return entry


def _get_portfolio_or_404(db: Session, portfolio_id: uuid.UUID) -> Portfolio:
    portfolio = db.get(Portfolio, portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found.")
    return portfolio


def _get_operation_or_404(db: Session, operation_id: uuid.UUID) -> Operation:
    operation = db.get(Operation, operation_id)
    if operation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found.")
    return operation


def _validate_operation_portfolio_link(
    db: Session,
    *,
    portfolio_id: uuid.UUID,
    operation_id: uuid.UUID | None,
) -> None:
    _get_portfolio_or_404(db, portfolio_id)
    if operation_id is None:
        return
    operation = _get_operation_or_404(db, operation_id)
    if operation.portfolio_id != portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The selected operation does not belong to the informed portfolio.",
        )


def create_cashflow_entry(
    db: Session,
    payload: CashflowEntryCreate,
    *,
    actor_user_id: uuid.UUID | None = None,
) -> CashflowEntry:
    _validate_operation_portfolio_link(
        db,
        portfolio_id=payload.portfolio_id,
        operation_id=payload.operation_id,
    )

    entry = CashflowEntry(**payload.model_dump())
    db.add(entry)
    db.flush()
    create_audit_log(
        db,
        entity_type="cashflow_entry",
        entity_id=str(entry.id),
        action=AuditAction.CREATED,
        new_value=model_to_dict(entry),
        user_id=actor_user_id,
    )
    db.commit()
    return get_cashflow_entry_or_404(db, entry.id)


def update_cashflow_entry(
    db: Session,
    entry: CashflowEntry,
    payload: CashflowEntryUpdate,
    *,
    actor_user_id: uuid.UUID | None = None,
) -> CashflowEntry:
    old_value = model_to_dict(entry)
    updates = payload.model_dump(exclude_unset=True)

    new_portfolio_id = updates.get("portfolio_id", entry.portfolio_id)
    new_operation_id = updates.get("operation_id", entry.operation_id)
    _validate_operation_portfolio_link(
        db,
        portfolio_id=new_portfolio_id,
        operation_id=new_operation_id,
    )

    for field, value in updates.items():
        setattr(entry, field, value)

    if entry.settlement_date < entry.entry_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Settlement date must be on or after entry date.",
        )

    db.add(entry)
    db.flush()
    create_audit_log(
        db,
        entity_type="cashflow_entry",
        entity_id=str(entry.id),
        action=AuditAction.UPDATED,
        old_value=old_value,
        new_value=model_to_dict(entry),
        user_id=actor_user_id,
    )
    db.commit()
    return get_cashflow_entry_or_404(db, entry.id)


def delete_cashflow_entry(
    db: Session,
    entry: CashflowEntry,
    *,
    actor_user_id: uuid.UUID | None = None,
) -> None:
    create_audit_log(
        db,
        entity_type="cashflow_entry",
        entity_id=str(entry.id),
        action=AuditAction.DELETED,
        old_value=model_to_dict(entry),
        user_id=actor_user_id,
    )
    db.flush()
    db.delete(entry)
    db.commit()
