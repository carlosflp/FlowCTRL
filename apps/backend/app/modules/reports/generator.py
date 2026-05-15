from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import ReportDatasetType, ReportTemplateType
from app.db.base import decimal_to_str
from app.modules.cashflow.models import CashflowEntry
from app.modules.operations.models import Operation
from app.modules.portfolios.models import Portfolio
from app.modules.pricing.models import AssetPrice
from app.modules.reports.definitions import get_report_dataset_definition, resolve_execution_dataset
from app.modules.reports.models import ReportExecution, ReportTemplate
from app.modules.reports.schemas import ReportExecutionParameters
from app.modules.reports.storage import get_report_media_type

PDF_PREVIEW_ROW_LIMIT = 30


@dataclass
class ReportArtifact:
    content: bytes
    file_type: str
    media_type: str


def build_report_artifact(
    db: Session,
    execution: ReportExecution,
    template: ReportTemplate,
) -> ReportArtifact:
    file_type = execution.file_type or template.template_type.value
    parameters = ReportExecutionParameters.model_validate(execution.parameters_json or {})
    dataset = resolve_execution_dataset(template.config_json, parameters.dataset)
    definition = get_report_dataset_definition(dataset)
    columns = list(parameters.columns or definition.columns)
    columns, rows = build_dataset_rows(
        db,
        dataset=dataset,
        portfolio_id=execution.portfolio_id,
        allowed_portfolio_ids=parameters.allowed_portfolio_ids,
        date_from=parameters.date_from,
        date_to=parameters.date_to,
        selected_columns=columns,
    )

    if file_type == ReportTemplateType.CSV.value:
        content = build_csv_content(columns, rows)
    elif file_type == ReportTemplateType.XLSX.value:
        content = build_xlsx_content(columns, rows)
    else:
        content = build_pdf_content(template.name, columns, rows)

    return ReportArtifact(
        content=content,
        file_type=file_type,
        media_type=get_report_media_type(file_type),
    )


def build_dataset_rows(
    db: Session,
    *,
    dataset: ReportDatasetType,
    portfolio_id,
    allowed_portfolio_ids,
    date_from: date | None,
    date_to: date | None,
    selected_columns: list[str],
) -> tuple[list[str], list[dict[str, object]]]:
    if dataset == ReportDatasetType.OPERATIONS:
        return build_operations_rows(
            db,
            portfolio_id=portfolio_id,
            allowed_portfolio_ids=allowed_portfolio_ids,
            date_from=date_from,
            date_to=date_to,
            selected_columns=selected_columns,
        )
    if dataset == ReportDatasetType.CASHFLOW:
        return build_cashflow_rows(
            db,
            portfolio_id=portfolio_id,
            allowed_portfolio_ids=allowed_portfolio_ids,
            date_from=date_from,
            date_to=date_to,
            selected_columns=selected_columns,
        )
    if dataset == ReportDatasetType.PRICING:
        return build_pricing_rows(
            db,
            date_from=date_from,
            date_to=date_to,
            selected_columns=selected_columns,
        )
    return build_portfolios_rows(
        db,
        portfolio_id=portfolio_id,
        allowed_portfolio_ids=allowed_portfolio_ids,
        selected_columns=selected_columns,
    )


def build_operations_rows(
    db: Session,
    *,
    portfolio_id,
    allowed_portfolio_ids,
    date_from: date | None,
    date_to: date | None,
    selected_columns: list[str],
) -> tuple[list[str], list[dict[str, object]]]:
    statement = (
        select(Operation)
        .options(selectinload(Operation.portfolio), selectinload(Operation.asset))
        .order_by(Operation.trade_date.desc(), Operation.created_at.desc())
    )
    if portfolio_id is not None:
        statement = statement.where(Operation.portfolio_id == portfolio_id)
    elif allowed_portfolio_ids:
        statement = statement.where(Operation.portfolio_id.in_(allowed_portfolio_ids))
    if date_from is not None:
        statement = statement.where(Operation.trade_date >= date_from)
    if date_to is not None:
        statement = statement.where(Operation.trade_date <= date_to)

    rows = []
    for operation in db.scalars(statement):
        rows.append(
            {
                "trade_date": format_date(operation.trade_date),
                "settlement_date": format_date(operation.settlement_date),
                "portfolio": operation.portfolio.name,
                "asset": operation.asset.ticker,
                "operation_type": operation.operation_type.value,
                "quantity": format_decimal(operation.quantity),
                "unit_price": format_decimal(operation.unit_price),
                "gross_value": format_decimal(operation.gross_value),
                "net_value": format_decimal(operation.net_value),
                "fees": format_decimal(operation.fees),
                "taxes": format_decimal(operation.taxes),
                "status": operation.status.value,
                "notes": operation.notes or "",
            }
        )

    return selected_columns, rows


def build_cashflow_rows(
    db: Session,
    *,
    portfolio_id,
    allowed_portfolio_ids,
    date_from: date | None,
    date_to: date | None,
    selected_columns: list[str],
) -> tuple[list[str], list[dict[str, object]]]:
    statement = (
        select(CashflowEntry)
        .options(selectinload(CashflowEntry.portfolio), selectinload(CashflowEntry.operation))
        .order_by(CashflowEntry.settlement_date.desc(), CashflowEntry.created_at.desc())
    )
    if portfolio_id is not None:
        statement = statement.where(CashflowEntry.portfolio_id == portfolio_id)
    elif allowed_portfolio_ids:
        statement = statement.where(CashflowEntry.portfolio_id.in_(allowed_portfolio_ids))
    if date_from is not None:
        statement = statement.where(CashflowEntry.settlement_date >= date_from)
    if date_to is not None:
        statement = statement.where(CashflowEntry.settlement_date <= date_to)

    rows = []
    for entry in db.scalars(statement):
        rows.append(
            {
                "entry_date": format_date(entry.entry_date),
                "settlement_date": format_date(entry.settlement_date),
                "portfolio": entry.portfolio.name,
                "description": entry.description,
                "entry_type": entry.entry_type.value,
                "amount": format_decimal(entry.amount),
                "status": entry.status.value,
                "operation_id": str(entry.operation_id) if entry.operation_id else "",
            }
        )

    return selected_columns, rows


def build_pricing_rows(
    db: Session,
    *,
    date_from: date | None,
    date_to: date | None,
    selected_columns: list[str],
) -> tuple[list[str], list[dict[str, object]]]:
    statement = (
        select(AssetPrice)
        .options(selectinload(AssetPrice.asset))
        .order_by(AssetPrice.price_date.desc(), AssetPrice.created_at.desc())
    )
    if date_from is not None:
        statement = statement.where(AssetPrice.price_date >= date_from)
    if date_to is not None:
        statement = statement.where(AssetPrice.price_date <= date_to)

    rows = []
    for price in db.scalars(statement):
        rows.append(
            {
                "price_date": format_date(price.price_date),
                "asset": price.asset.ticker,
                "price": format_decimal(price.price),
                "source": price.source,
                "is_validated": "yes" if price.is_validated else "no",
            }
        )

    return selected_columns, rows


def build_portfolios_rows(
    db: Session,
    *,
    portfolio_id,
    allowed_portfolio_ids,
    selected_columns: list[str],
) -> tuple[list[str], list[dict[str, object]]]:
    statement = select(Portfolio).order_by(Portfolio.name.asc())
    if portfolio_id is not None:
        statement = statement.where(Portfolio.id == portfolio_id)
    elif allowed_portfolio_ids:
        statement = statement.where(Portfolio.id.in_(allowed_portfolio_ids))
    rows = []
    for portfolio in db.scalars(statement):
        rows.append(
            {
                "name": portfolio.name,
                "base_currency": portfolio.base_currency,
                "benchmark": portfolio.benchmark or "",
                "is_active": "yes" if portfolio.is_active else "no",
                "description": portfolio.description or "",
            }
        )

    return selected_columns, rows


def build_csv_content(columns: list[str], rows: list[dict[str, object]]) -> bytes:
    dataframe = pd.DataFrame(rows, columns=columns)
    return dataframe.to_csv(index=False).encode("utf-8")


def build_xlsx_content(columns: list[str], rows: list[dict[str, object]]) -> bytes:
    dataframe = pd.DataFrame(rows, columns=columns)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="xlsxwriter") as writer:
        dataframe.to_excel(writer, index=False, sheet_name="report")
        worksheet = writer.sheets["report"]
        worksheet.freeze_panes(1, 0)
        if columns:
            worksheet.autofilter(0, 0, max(len(rows), 1), len(columns) - 1)
    return buffer.getvalue()


def build_pdf_content(title: str, columns: list[str], rows: list[dict[str, object]]) -> bytes:
    buffer = io.BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    preview_rows = rows[:PDF_PREVIEW_ROW_LIMIT]
    table_data = [columns]
    table_data.extend([[str(row.get(column, "")) for column in columns] for row in preview_rows])

    story = [
        Paragraph(title, styles["Title"]),
        Spacer(1, 12),
        Paragraph(f"Rows generated: {len(rows)}", styles["BodyText"]),
        Spacer(1, 12),
    ]

    if columns:
        table = Table(table_data, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#134e4a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d5d8dc")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f7f7f4")],
                    ),
                ]
            )
        )
        story.append(table)

    if len(rows) > PDF_PREVIEW_ROW_LIMIT:
        story.extend(
            [
                Spacer(1, 12),
                Paragraph(
                    f"Preview limited to the first {PDF_PREVIEW_ROW_LIMIT} rows for PDF rendering.",
                    styles["Italic"],
                ),
            ]
        )

    document.build(story)
    return buffer.getvalue()


def format_decimal(value: Decimal | None) -> str:
    return decimal_to_str(value) or ""


def format_date(value: date | None) -> str:
    if value is None:
        return ""
    return value.isoformat()
