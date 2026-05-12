from datetime import date
from decimal import Decimal
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import OperationStatus, OperationType
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, money_column, quantity_column

if TYPE_CHECKING:
    from app.modules.assets.models import Asset
    from app.modules.cashflow.models import CashflowEntry
    from app.modules.portfolios.models import Portfolio


class Operation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "operations"

    portfolio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portfolios.id"), nullable=False)
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id"), nullable=False)
    operation_type: Mapped[OperationType] = mapped_column(
        Enum(OperationType, name="operation_type", native_enum=False),
        nullable=False,
    )
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    settlement_date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity: Mapped[Decimal] = quantity_column()
    unit_price: Mapped[Decimal] = money_column()
    gross_value: Mapped[Decimal] = money_column()
    net_value: Mapped[Decimal] = money_column()
    fees: Mapped[Decimal] = money_column()
    taxes: Mapped[Decimal] = money_column()
    status: Mapped[OperationStatus] = mapped_column(
        Enum(OperationStatus, name="operation_status", native_enum=False),
        default=OperationStatus.DRAFT,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="operations")
    asset: Mapped["Asset"] = relationship(back_populates="operations")
    cashflow_entries: Mapped[list["CashflowEntry"]] = relationship(back_populates="operation")

