from datetime import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.enums import ReportExecutionStatus, ReportTemplateType
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, optional_json_column

if TYPE_CHECKING:
    from app.modules.portfolios.models import Portfolio


class ReportTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "report_templates"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_type: Mapped[ReportTemplateType] = mapped_column(
        Enum(ReportTemplateType, name="report_template_type", native_enum=False),
        nullable=False,
    )
    config_json: Mapped[dict | list | None] = optional_json_column()
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    executions: Mapped[list["ReportExecution"]] = relationship(back_populates="template")


class ReportExecution(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "report_executions"

    template_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("report_templates.id"), nullable=False)
    portfolio_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("portfolios.id"), nullable=True)
    status: Mapped[ReportExecutionStatus] = mapped_column(
        Enum(ReportExecutionStatus, name="report_execution_status", native_enum=False),
        default=ReportExecutionStatus.QUEUED,
        nullable=False,
    )
    parameters_json: Mapped[dict | list | None] = optional_json_column()
    file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    file_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    template: Mapped["ReportTemplate"] = relationship(back_populates="executions")
    portfolio: Mapped["Portfolio | None"] = relationship(back_populates="report_executions")
