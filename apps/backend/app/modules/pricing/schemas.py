import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class AssetPriceBase(BaseModel):
    asset_id: uuid.UUID
    price_date: date
    price: Decimal = Field(ge=0)
    source: str = Field(min_length=1, max_length=64)
    is_validated: bool = False


class AssetPriceCreate(AssetPriceBase):
    pass


class AssetPriceUpdate(BaseModel):
    asset_id: uuid.UUID | None = None
    price_date: date | None = None
    price: Decimal | None = Field(default=None, ge=0)
    source: str | None = Field(default=None, min_length=1, max_length=64)
    is_validated: bool | None = None


class AssetPriceAssetSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticker: str
    name: str


class AssetPriceRead(AssetPriceBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    asset: AssetPriceAssetSummary
