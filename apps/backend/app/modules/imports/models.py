from datetime import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ImportDatasetType, ImportJobStatus, ImportSourceType
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, optional_json_column

if TYPE_CHECKING:
    from app.modules.portfolios.models import Portfolio
    from app.modules.users.models import User


class ImportJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "import_jobs"

    portfolio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portfolios.id"), nullable=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    dataset: Mapped[ImportDatasetType] = mapped_column(
        Enum(ImportDatasetType, name="import_dataset_type", native_enum=False),
        nullable=False,
    )
    source: Mapped[ImportSourceType] = mapped_column(
        Enum(ImportSourceType, name="import_source_type", native_enum=False),
        nullable=False,
    )
    status: Mapped[ImportJobStatus] = mapped_column(
        Enum(ImportJobStatus, name="import_job_status", native_enum=False),
        nullable=False,
        default=ImportJobStatus.QUEUED,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(16), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    preview_rows_json: Mapped[list | dict | None] = optional_json_column()
    result_json: Mapped[list | dict | None] = optional_json_column()
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    processed_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    successful_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    portfolio: Mapped["Portfolio"] = relationship()
    created_by_user: Mapped["User | None"] = relationship()
