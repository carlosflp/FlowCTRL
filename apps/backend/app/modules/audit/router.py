from datetime import date
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.audit.schemas import AuditLogRead
from app.modules.audit.service import list_audit_logs
from app.modules.auth.dependencies import AdminAccessUser

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogRead])
def read_audit_logs(
    current_user: AdminAccessUser,
    db: Session = Depends(get_db),
    entity_type: str | None = None,
    action: str | None = None,
    user_id: uuid.UUID | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=120, ge=1, le=500),
) -> list[AuditLogRead]:
    return list_audit_logs(
        db,
        entity_type=entity_type,
        action=action,
        user_id=user_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
