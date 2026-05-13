import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.core.enums import AssetType


class PositionPortfolioSummary(BaseModel):
    id: uuid.UUID
    name: str
    base_currency: str


class PositionAssetSummary(BaseModel):
    id: uuid.UUID
    ticker: str
    name: str
    asset_type: AssetType


class PositionRead(BaseModel):
    as_of_date: date
    portfolio: PositionPortfolioSummary
    asset: PositionAssetSummary
    quantity: Decimal
    average_cost: Decimal
    total_cost_basis: Decimal
    latest_price: Decimal | None = None
    latest_price_date: date | None = None
    price_source: str | None = None
    is_price_validated: bool | None = None
    market_value: Decimal | None = None
    unrealized_pnl: Decimal | None = None
    unrealized_pnl_pct: Decimal | None = None
    last_trade_date: date
    operation_count: int


class PositionOverview(BaseModel):
    as_of_date: date
    open_positions: int
    priced_positions: int
    unpriced_positions: int
    total_cost_basis: Decimal
    total_market_value: Decimal
    total_unrealized_pnl: Decimal
    pricing_coverage_pct: Decimal
