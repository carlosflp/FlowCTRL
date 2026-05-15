from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict

from app.core.enums import UserRole


class AuditActorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    entity_type: str
    entity_id: str
    action: str
    old_value_json: dict | list | None
    new_value_json: dict | list | None
    created_at: datetime
    updated_at: datetime
    user: AuditActorRead | None
