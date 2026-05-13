import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import UserRole


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    is_superuser: bool
    role: UserRole
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str = Field(min_length=8)
    role: UserRole = UserRole.VIEWER
    is_active: bool = True
    is_superuser: bool = False


class UserUpdate(BaseModel):
    email: str | None = None
    full_name: str | None = None
    password: str | None = Field(default=None, min_length=8)
    role: UserRole | None = None
    is_active: bool | None = None
    is_superuser: bool | None = None
