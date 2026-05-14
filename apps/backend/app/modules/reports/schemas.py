import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.enums import ReportDatasetType, ReportExecutionStatus, ReportTemplateType


class ReportTemplateBase(BaseModel):
    name: str = Field(min_length=3, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    template_type: ReportTemplateType = ReportTemplateType.XLSX
    config_json: dict | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_config(self) -> "ReportTemplateBase":
        config = self.config_json or {}
        dataset = config.get("dataset", ReportDatasetType.OPERATIONS.value)
        ReportDatasetType(dataset)
        return self


class ReportTemplateCreate(ReportTemplateBase):
    pass


class ReportTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    template_type: ReportTemplateType | None = None
    config_json: dict | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_config(self) -> "ReportTemplateUpdate":
        if self.config_json is None:
            return self
        dataset = self.config_json.get("dataset", ReportDatasetType.OPERATIONS.value)
        ReportDatasetType(dataset)
        return self


class ReportTemplateRead(ReportTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ReportTemplateSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    template_type: ReportTemplateType


class ReportExecutionPortfolioSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class ReportExecutionParameters(BaseModel):
    dataset: ReportDatasetType | None = None
    date_from: date | None = None
    date_to: date | None = None
    columns: list[str] | None = None

    @model_validator(mode="after")
    def validate_parameters(self) -> "ReportExecutionParameters":
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from cannot be later than date_to.")

        if self.columns is not None:
            normalized_columns: list[str] = []
            seen_columns: set[str] = set()
            for column in self.columns:
                normalized = column.strip()
                if not normalized:
                    raise ValueError("columns cannot contain blank values.")
                if normalized in seen_columns:
                    continue
                normalized_columns.append(normalized)
                seen_columns.add(normalized)

            if not normalized_columns:
                raise ValueError("columns must contain at least one value when provided.")

            self.columns = normalized_columns

        return self


class ReportExecutionBase(BaseModel):
    file_type: ReportTemplateType | None = None
    parameters_json: ReportExecutionParameters | None = None


class ReportExecutionCreate(ReportExecutionBase):
    template_id: uuid.UUID
    portfolio_id: uuid.UUID | None = None


class ReportExecutionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    template_id: uuid.UUID
    portfolio_id: uuid.UUID | None
    status: ReportExecutionStatus
    parameters_json: ReportExecutionParameters | None
    file_path: str | None
    file_type: ReportTemplateType | None
    created_at: datetime
    finished_at: datetime | None
    template: ReportTemplateSummary
    portfolio: ReportExecutionPortfolioSummary | None
