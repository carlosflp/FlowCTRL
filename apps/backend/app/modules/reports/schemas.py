from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict

from app.core.enums import ReportExecutionStatus, ReportTemplateType


class ReportTemplateBase(BaseModel):
    name: str
    description: str | None = None
    template_type: ReportTemplateType
    config_json: dict | list | None = None
    is_active: bool = True


class ReportTemplateCreate(ReportTemplateBase):
    pass


class ReportTemplateRead(ReportTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ReportExecutionBase(BaseModel):
    template_id: uuid.UUID
    portfolio_id: uuid.UUID | None = None
    status: ReportExecutionStatus = ReportExecutionStatus.QUEUED
    parameters_json: dict | list | None = None
    file_path: str | None = None
    file_type: str | None = None


class ReportExecutionCreate(ReportExecutionBase):
    pass


class ReportExecutionRead(ReportExecutionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    finished_at: datetime | None

