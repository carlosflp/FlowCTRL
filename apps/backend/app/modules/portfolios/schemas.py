from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field


class PortfolioBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None
    base_currency: str = Field(default="BRL", min_length=3, max_length=8)
    benchmark: str | None = Field(default=None, max_length=64)
    is_active: bool = True


class PortfolioCreate(PortfolioBase):
    pass


class PortfolioUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    base_currency: str | None = Field(default=None, min_length=3, max_length=8)
    benchmark: str | None = Field(default=None, max_length=64)
    is_active: bool | None = None


class PortfolioRead(PortfolioBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

