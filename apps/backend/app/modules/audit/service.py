from datetime import date, datetime, time, timedelta
import uuid
from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import AuditAction
from app.modules.audit.models import AuditLog
from app.modules.users.models import User


def create_audit_log(
    db: Session,
    *,
    entity_type: str,
    entity_id: str,
    action: AuditAction,
    new_value: dict[str, Any] | None = None,
    old_value: dict[str, Any] | None = None,
    user_id: uuid.UUID | None = None,
) -> AuditLog:
    audit_log = AuditLog(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action.value,
        old_value_json=jsonable_encoder(old_value),
        new_value_json=jsonable_encoder(new_value),
    )
    db.add(audit_log)
    return audit_log


def list_audit_logs(
    db: Session,
    *,
    entity_type: str | None = None,
    action: str | None = None,
    user_id: uuid.UUID | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 120,
) -> list[AuditLog]:
    statement = (
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )

    if entity_type:
        statement = statement.where(AuditLog.entity_type == entity_type.strip().lower())
    if action:
        statement = statement.where(AuditLog.action == action.strip().lower())
    if user_id:
        statement = statement.where(AuditLog.user_id == user_id)
    if date_from:
        statement = statement.where(AuditLog.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        statement = statement.where(
            AuditLog.created_at < datetime.combine(date_to + timedelta(days=1), time.min)
        )
    if search:
        normalized_search = f"%{search.strip()}%"
        statement = statement.outerjoin(AuditLog.user).where(
            or_(
                AuditLog.entity_type.ilike(normalized_search),
                AuditLog.entity_id.ilike(normalized_search),
                User.full_name.ilike(normalized_search),
                User.email.ilike(normalized_search),
            )
        )

    return list(db.scalars(statement).all())
