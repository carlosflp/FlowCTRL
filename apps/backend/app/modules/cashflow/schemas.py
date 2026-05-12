from datetime import date, datetime
from decimal import Decimal
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import CashflowEntryType, CashflowStatus


class CashflowEntryBase(BaseModel):
    portfolio_id: uuid.UUID
    operation_id: uuid.UUID | None = None
    entry_date: date
    settlement_date: date
    description: str = Field(min_length=2)
    entry_type: CashflowEntryType
    amount: Decimal = Field(ge=0)
    status: CashflowStatus = CashflowStatus.PENDING


class CashflowEntryCreate(CashflowEntryBase):
    pass


class CashflowEntryRead(CashflowEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

