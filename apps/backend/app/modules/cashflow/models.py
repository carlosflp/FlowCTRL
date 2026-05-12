from datetime import date
from decimal import Decimal
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import CashflowEntryType, CashflowStatus
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, money_column

if TYPE_CHECKING:
    from app.modules.operations.models import Operation
    from app.modules.portfolios.models import Portfolio


class CashflowEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "cashflow_entries"

    portfolio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portfolios.id"), nullable=False)
    operation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("operations.id"), nullable=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    settlement_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    entry_type: Mapped[CashflowEntryType] = mapped_column(
        Enum(CashflowEntryType, name="cashflow_entry_type", native_enum=False),
        nullable=False,
    )
    status: Mapped[CashflowStatus] = mapped_column(
        Enum(CashflowStatus, name="cashflow_status", native_enum=False),
        nullable=False,
        default=CashflowStatus.PENDING,
    )
    amount: Mapped[Decimal] = money_column()

    portfolio: Mapped["Portfolio"] = relationship(back_populates="cashflow_entries")
    operation: Mapped["Operation | None"] = relationship(back_populates="cashflow_entries")
