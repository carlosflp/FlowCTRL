from datetime import date, datetime
from decimal import Decimal
import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.enums import OperationStatus, OperationType


class OperationBase(BaseModel):
    portfolio_id: uuid.UUID
    asset_id: uuid.UUID
    operation_type: OperationType
    trade_date: date
    settlement_date: date
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)
    gross_value: Decimal | None = Field(default=None, ge=0)
    net_value: Decimal | None = Field(default=None, ge=0)
    fees: Decimal = Field(default=Decimal("0"), ge=0)
    taxes: Decimal = Field(default=Decimal("0"), ge=0)
    status: OperationStatus = OperationStatus.DRAFT
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "OperationBase":
        if self.settlement_date < self.trade_date:
            raise ValueError("Settlement date must be on or after trade date.")
        return self


class OperationCreate(OperationBase):
    pass


class OperationUpdate(BaseModel):
    portfolio_id: uuid.UUID | None = None
    asset_id: uuid.UUID | None = None
    operation_type: OperationType | None = None
    trade_date: date | None = None
    settlement_date: date | None = None
    quantity: Decimal | None = Field(default=None, gt=0)
    unit_price: Decimal | None = Field(default=None, ge=0)
    gross_value: Decimal | None = Field(default=None, ge=0)
    net_value: Decimal | None = Field(default=None, ge=0)
    fees: Decimal | None = Field(default=None, ge=0)
    taxes: Decimal | None = Field(default=None, ge=0)
    status: OperationStatus | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "OperationUpdate":
        if self.trade_date and self.settlement_date and self.settlement_date < self.trade_date:
            raise ValueError("Settlement date must be on or after trade date.")
        return self


class OperationPortfolioSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class OperationAssetSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticker: str
    name: str


class OperationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    portfolio_id: uuid.UUID
    asset_id: uuid.UUID
    operation_type: OperationType
    trade_date: date
    settlement_date: date
    quantity: Decimal
    unit_price: Decimal
    gross_value: Decimal
    net_value: Decimal
    fees: Decimal
    taxes: Decimal
    status: OperationStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime
    portfolio: OperationPortfolioSummary
    asset: OperationAssetSummary

