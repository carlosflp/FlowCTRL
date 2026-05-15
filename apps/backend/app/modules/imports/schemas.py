from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict

from app.core.enums import ImportDatasetType, ImportJobStatus, ImportSourceType, UserRole


class ImportJobPortfolioSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class ImportJobUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole


class ImportJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    portfolio_id: uuid.UUID
    created_by_user_id: uuid.UUID | None
    dataset: ImportDatasetType
    source: ImportSourceType
    status: ImportJobStatus
    file_name: str
    file_type: str
    storage_path: str
    preview_rows_json: list[dict[str, object | None]] | list | dict | None
    result_json: dict[str, object | list | None] | list | None
    total_rows: int
    processed_rows: int
    successful_rows: int
    failed_rows: int
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    updated_at: datetime
    portfolio: ImportJobPortfolioSummary
    created_by_user: ImportJobUserSummary | None
