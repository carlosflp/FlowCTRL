from datetime import date, datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import AssetType


class AssetBase(BaseModel):
    ticker: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=2, max_length=255)
    asset_type: AssetType
    issuer: str | None = Field(default=None, max_length=255)
    indexer: str | None = Field(default=None, max_length=64)
    maturity_date: date | None = None
    is_active: bool = True


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    ticker: str | None = Field(default=None, min_length=1, max_length=32)
    name: str | None = Field(default=None, min_length=2, max_length=255)
    asset_type: AssetType | None = None
    issuer: str | None = Field(default=None, max_length=255)
    indexer: str | None = Field(default=None, max_length=64)
    maturity_date: date | None = None
    is_active: bool | None = None


class AssetRead(AssetBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

