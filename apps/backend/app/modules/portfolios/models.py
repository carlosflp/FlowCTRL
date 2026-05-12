from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.modules.cashflow.models import CashflowEntry
    from app.modules.operations.models import Operation
    from app.modules.reports.models import ReportExecution


class Portfolio(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "portfolios"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_currency: Mapped[str] = mapped_column(String(8), nullable=False, default="BRL")
    benchmark: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    operations: Mapped[list["Operation"]] = relationship(back_populates="portfolio")
    cashflow_entries: Mapped[list["CashflowEntry"]] = relationship(back_populates="portfolio")
    report_executions: Mapped[list["ReportExecution"]] = relationship(back_populates="portfolio")
