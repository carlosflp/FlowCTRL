from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.enums import ReportDatasetType

CUSTOM_TEMPLATE_CONFIG_KEY = "custom_template"
ALLOW_CUSTOM_DATASET_CONFIG_KEY = "allow_custom_dataset"
HIDDEN_TEMPLATE_CONFIG_KEY = "hidden"


@dataclass(frozen=True)
class ReportDatasetDefinition:
    columns: tuple[str, ...]
    date_field: str | None
    supports_portfolio_scope: bool


REPORT_DATASET_DEFINITIONS: dict[ReportDatasetType, ReportDatasetDefinition] = {
    ReportDatasetType.OPERATIONS: ReportDatasetDefinition(
        columns=(
            "trade_date",
            "settlement_date",
            "portfolio",
            "asset",
            "operation_type",
            "quantity",
            "unit_price",
            "gross_value",
            "net_value",
            "fees",
            "taxes",
            "status",
            "notes",
        ),
        date_field="trade_date",
        supports_portfolio_scope=True,
    ),
    ReportDatasetType.CASHFLOW: ReportDatasetDefinition(
        columns=(
            "entry_date",
            "settlement_date",
            "portfolio",
            "description",
            "entry_type",
            "amount",
            "status",
            "operation_id",
        ),
        date_field="settlement_date",
        supports_portfolio_scope=True,
    ),
    ReportDatasetType.PRICING: ReportDatasetDefinition(
        columns=("price_date", "asset", "price", "source", "is_validated"),
        date_field="price_date",
        supports_portfolio_scope=False,
    ),
    ReportDatasetType.PORTFOLIOS: ReportDatasetDefinition(
        columns=("name", "base_currency", "benchmark", "is_active", "description"),
        date_field=None,
        supports_portfolio_scope=False,
    ),
}


def get_report_dataset_definition(dataset: ReportDatasetType) -> ReportDatasetDefinition:
    return REPORT_DATASET_DEFINITIONS[dataset]


def normalize_report_template_config(config_json: dict | list | None) -> dict[str, Any]:
    if isinstance(config_json, dict):
        return dict(config_json)
    return {}


def resolve_report_dataset_from_config(config_json: dict | list | None) -> ReportDatasetType:
    config = normalize_report_template_config(config_json)
    dataset = config.get("dataset", ReportDatasetType.OPERATIONS.value)
    return ReportDatasetType(dataset)


def template_allows_custom_dataset(config_json: dict | list | None) -> bool:
    config = normalize_report_template_config(config_json)
    return bool(config.get(ALLOW_CUSTOM_DATASET_CONFIG_KEY))


def is_custom_report_template(config_json: dict | list | None) -> bool:
    config = normalize_report_template_config(config_json)
    return bool(config.get(CUSTOM_TEMPLATE_CONFIG_KEY))


def is_hidden_report_template(config_json: dict | list | None) -> bool:
    config = normalize_report_template_config(config_json)
    return bool(config.get(HIDDEN_TEMPLATE_CONFIG_KEY))


def resolve_execution_dataset(
    config_json: dict | list | None,
    requested_dataset: ReportDatasetType | None,
) -> ReportDatasetType:
    template_dataset = resolve_report_dataset_from_config(config_json)
    if requested_dataset is None:
        return template_dataset
    if template_allows_custom_dataset(config_json):
        return requested_dataset
    if requested_dataset != template_dataset:
        raise ValueError("Dataset override is only supported for customizable report templates.")
    return template_dataset
