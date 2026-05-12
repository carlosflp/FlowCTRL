from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    email: str
    full_name: str
    hashed_password: str | None = None
    is_active: bool = True
    is_superuser: bool = False

