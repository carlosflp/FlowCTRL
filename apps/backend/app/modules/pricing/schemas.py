from datetime import date, datetime
from decimal import Decimal
import uuid

from pydantic import BaseModel, ConfigDict, Field


class AssetPriceBase(BaseModel):
    asset_id: uuid.UUID
    price_date: date
    price: Decimal = Field(ge=0)
    source: str = Field(min_length=1, max_length=64)
    is_validated: bool = False


class AssetPriceCreate(AssetPriceBase):
    pass


class AssetPriceRead(AssetPriceBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

