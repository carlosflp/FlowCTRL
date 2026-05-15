import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import AuditAction
from app.db.utils import model_to_dict
from app.modules.assets.models import Asset
from app.modules.audit.service import create_audit_log
from app.modules.operations.models import Operation
from app.modules.operations.schemas import OperationCreate, OperationUpdate
from app.modules.portfolios.service import (
    ensure_user_has_portfolio_access,
    get_accessible_portfolio_ids,
    user_has_global_portfolio_access,
)
from app.modules.users.models import User


def list_operations(
    db: Session,
    *,
    current_user: User,
    portfolio_id: uuid.UUID | None = None,
) -> list[Operation]:
    statement = (
        select(Operation)
        .options(selectinload(Operation.portfolio), selectinload(Operation.asset))
        .order_by(Operation.trade_date.desc(), Operation.created_at.desc())
    )
    if portfolio_id is not None:
        ensure_user_has_portfolio_access(db, current_user=current_user, portfolio_id=portfolio_id)
        statement = statement.where(Operation.portfolio_id == portfolio_id)
    elif not user_has_global_portfolio_access(current_user):
        accessible_portfolio_ids = get_accessible_portfolio_ids(db, current_user)
        if not accessible_portfolio_ids:
            return []
        statement = statement.where(Operation.portfolio_id.in_(accessible_portfolio_ids))
    return list(db.scalars(statement))


def get_operation_or_404(
    db: Session,
    operation_id: uuid.UUID,
    *,
    current_user: User,
) -> Operation:
    statement = (
        select(Operation)
        .where(Operation.id == operation_id)
        .options(selectinload(Operation.portfolio), selectinload(Operation.asset))
    )
    operation = db.scalar(statement)
    if operation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found.")
    ensure_user_has_portfolio_access(
        db,
        current_user=current_user,
        portfolio_id=operation.portfolio_id,
    )
    return operation


def _ensure_asset_exists(db: Session, asset_id: uuid.UUID) -> None:
    if db.get(Asset, asset_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")


def _calculate_gross_value(quantity: Decimal, unit_price: Decimal) -> Decimal:
    return quantity * unit_price


def _calculate_net_value(gross_value: Decimal, fees: Decimal, taxes: Decimal) -> Decimal:
    return gross_value - fees - taxes


def _serialize_operation(operation: Operation) -> dict:
    return model_to_dict(operation)


def create_operation(
    db: Session,
    payload: OperationCreate,
    *,
    current_user: User,
    actor_user_id: uuid.UUID | None = None,
) -> Operation:
    ensure_user_has_portfolio_access(db, current_user=current_user, portfolio_id=payload.portfolio_id)
    _ensure_asset_exists(db, payload.asset_id)

    gross_value = payload.gross_value or _calculate_gross_value(
        payload.quantity,
        payload.unit_price,
    )
    net_value = payload.net_value or _calculate_net_value(gross_value, payload.fees, payload.taxes)

    operation = Operation(
        **payload.model_dump(exclude={"gross_value", "net_value"}),
        gross_value=gross_value,
        net_value=net_value,
    )

    db.add(operation)
    db.flush()
    create_audit_log(
        db,
        entity_type="operation",
        entity_id=str(operation.id),
        action=AuditAction.CREATED,
        new_value=_serialize_operation(operation),
        user_id=actor_user_id,
    )
    db.commit()
    return get_operation_or_404(db, operation.id, current_user=current_user)


def update_operation(
    db: Session,
    operation: Operation,
    payload: OperationUpdate,
    *,
    current_user: User,
    actor_user_id: uuid.UUID | None = None,
) -> Operation:
    old_value = _serialize_operation(operation)
    updates = payload.model_dump(exclude_unset=True)

    new_portfolio_id = updates.get("portfolio_id", operation.portfolio_id)
    new_asset_id = updates.get("asset_id", operation.asset_id)
    ensure_user_has_portfolio_access(db, current_user=current_user, portfolio_id=new_portfolio_id)
    _ensure_asset_exists(db, new_asset_id)

    for field, value in updates.items():
        setattr(operation, field, value)

    if operation.settlement_date < operation.trade_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Settlement date must be on or after trade date.",
        )

    gross_value = operation.gross_value
    if any(key in updates for key in {"quantity", "unit_price"}) and "gross_value" not in updates:
        gross_value = _calculate_gross_value(operation.quantity, operation.unit_price)
        operation.gross_value = gross_value

    should_recalculate_net_value = any(
        key in updates for key in {"gross_value", "fees", "taxes", "quantity", "unit_price"}
    )
    if should_recalculate_net_value and "net_value" not in updates:
        operation.net_value = _calculate_net_value(
            operation.gross_value,
            operation.fees,
            operation.taxes,
        )

    db.add(operation)
    db.flush()
    create_audit_log(
        db,
        entity_type="operation",
        entity_id=str(operation.id),
        action=AuditAction.UPDATED,
        old_value=old_value,
        new_value=_serialize_operation(operation),
        user_id=actor_user_id,
    )
    db.commit()
    return get_operation_or_404(db, operation.id, current_user=current_user)


def delete_operation(
    db: Session,
    operation: Operation,
    *,
    current_user: User,
    actor_user_id: uuid.UUID | None = None,
) -> None:
    ensure_user_has_portfolio_access(
        db,
        current_user=current_user,
        portfolio_id=operation.portfolio_id,
    )
    old_value = _serialize_operation(operation)
    create_audit_log(
        db,
        entity_type="operation",
        entity_id=str(operation.id),
        action=AuditAction.DELETED,
        old_value=old_value,
        user_id=actor_user_id,
    )
    db.flush()
    db.delete(operation)
    db.commit()
