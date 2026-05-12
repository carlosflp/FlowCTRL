import uuid
from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.core.enums import AuditAction
from app.modules.audit.models import AuditLog


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
