import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.enums import CashflowEntryType, CashflowStatus


class CashflowEntryBase(BaseModel):
    portfolio_id: uuid.UUID
    operation_id: uuid.UUID | None = None
    entry_date: date
    settlement_date: date
    description: str = Field(min_length=2)
    entry_type: CashflowEntryType
    amount: Decimal = Field(gt=0)
    status: CashflowStatus = CashflowStatus.PENDING

    @model_validator(mode="after")
    def validate_dates(self) -> "CashflowEntryBase":
        if self.settlement_date < self.entry_date:
            raise ValueError("Settlement date must be on or after entry date.")
        return self


class CashflowEntryCreate(CashflowEntryBase):
    pass


class CashflowEntryUpdate(BaseModel):
    portfolio_id: uuid.UUID | None = None
    operation_id: uuid.UUID | None = None
    entry_date: date | None = None
    settlement_date: date | None = None
    description: str | None = Field(default=None, min_length=2)
    entry_type: CashflowEntryType | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    status: CashflowStatus | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "CashflowEntryUpdate":
        if self.entry_date and self.settlement_date and self.settlement_date < self.entry_date:
            raise ValueError("Settlement date must be on or after entry date.")
        return self


class CashflowPortfolioSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class CashflowOperationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    operation_type: str
    status: str


class CashflowEntryRead(CashflowEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    portfolio: CashflowPortfolioSummary
    operation: CashflowOperationSummary | None
