from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO, StringIO
import unicodedata

import pandas as pd

from app.core.enums import ImportDatasetType

OPERATIONS_ALIASES = {
    "asset_ticker": ("asset_ticker", "ticker", "ativo", "asset", "codigo_ativo"),
    "operation_type": ("operation_type", "tipo", "tipo_operacao"),
    "trade_date": ("trade_date", "data_trade", "trade_date", "data_operacao", "data"),
    "settlement_date": ("settlement_date", "data_liquidacao", "liquidacao", "settlement"),
    "quantity": ("quantity", "quantidade", "qtd"),
    "unit_price": ("unit_price", "preco_unitario", "preco", "pu"),
    "gross_value": ("gross_value", "valor_bruto"),
    "net_value": ("net_value", "valor_liquido", "valor_liquido"),
    "fees": ("fees", "taxas", "custos"),
    "taxes": ("taxes", "impostos"),
    "status": ("status", "situacao"),
    "notes": ("notes", "observacoes", "observacao"),
}

CASHFLOW_ALIASES = {
    "entry_date": ("entry_date", "data_evento", "data"),
    "settlement_date": ("settlement_date", "data_liquidacao", "liquidacao"),
    "description": ("description", "descricao", "historico"),
    "entry_type": ("entry_type", "tipo", "tipo_evento"),
    "amount": ("amount", "valor", "montante"),
    "status": ("status", "situacao"),
}

PRICING_ALIASES = {
    "asset_ticker": ("asset_ticker", "ticker", "ativo", "asset", "codigo_ativo"),
    "price_date": ("price_date", "data_preco", "data"),
    "price": ("price", "preco", "pu"),
    "source": ("source", "fonte", "origem"),
    "is_validated": ("is_validated", "validado", "homologado"),
}


def get_file_type(file_name: str) -> str:
    lowered = file_name.lower()
    if lowered.endswith(".csv"):
        return "csv"
    if lowered.endswith(".xlsx"):
        return "xlsx"
    raise ValueError("Supported import file types are CSV and XLSX.")


def normalize_column_name(value: str) -> str:
    ascii_value = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    return ascii_value.strip().lower().replace(" ", "_").replace("-", "_")


def load_import_dataframe(content: bytes, file_type: str) -> pd.DataFrame:
    if file_type == "csv":
        dataframe = pd.read_csv(StringIO(content.decode("utf-8-sig")))
    elif file_type == "xlsx":
        dataframe = pd.read_excel(BytesIO(content))
    else:  # pragma: no cover - guarded by validation
        raise ValueError("Unsupported import file type.")

    dataframe = dataframe.rename(columns=lambda column: normalize_column_name(str(column)))
    return dataframe.where(pd.notnull(dataframe), None)


def serialize_preview_value(value: object | None) -> object | None:
    if value is None:
        return None
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime().date().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float, str)):
        return value
    return str(value)


def get_preview_rows(dataframe: pd.DataFrame, *, limit: int = 5) -> list[dict[str, object | None]]:
    rows: list[dict[str, object | None]] = []
    for _, row in dataframe.head(limit).iterrows():
        rows.append({column: serialize_preview_value(value) for column, value in row.to_dict().items()})
    return rows


def get_aliases_for_dataset(dataset: ImportDatasetType) -> dict[str, tuple[str, ...]]:
    if dataset is ImportDatasetType.OPERATIONS:
        return OPERATIONS_ALIASES
    if dataset is ImportDatasetType.CASHFLOW:
        return CASHFLOW_ALIASES
    return PRICING_ALIASES


def extract_value(row: dict[str, object | None], aliases: tuple[str, ...]) -> object | None:
    for alias in aliases:
        if alias in row and row[alias] not in (None, ""):
            return row[alias]
    return None


def parse_string(value: object | None, *, field_name: str, required: bool = True) -> str | None:
    if value in (None, ""):
        if required:
            raise ValueError(f"Field '{field_name}' is required.")
        return None
    return str(value).strip()


def parse_decimal(value: object | None, *, field_name: str, required: bool = True, default: str | None = None) -> str | None:
    if value in (None, ""):
        if default is not None:
            return default
        if required:
            raise ValueError(f"Field '{field_name}' is required.")
        return None

    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, (int, float)):
        return format(Decimal(str(value)), "f")

    normalized = str(value).strip().replace(" ", "")
    if "," in normalized and "." in normalized:
        if normalized.rfind(",") > normalized.rfind("."):
            normalized = normalized.replace(".", "").replace(",", ".")
        else:
            normalized = normalized.replace(",", "")
    else:
        normalized = normalized.replace(",", ".")

    try:
        return format(Decimal(normalized), "f")
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Field '{field_name}' must be a valid decimal.") from exc


def parse_date_string(value: object | None, *, field_name: str, required: bool = True, default: str | None = None) -> str | None:
    if value in (None, ""):
        if default is not None:
            return default
        if required:
            raise ValueError(f"Field '{field_name}' is required.")
        return None

    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime().date().isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()

    parsed = pd.to_datetime(str(value), errors="coerce", dayfirst=False)
    if pd.isna(parsed):
        raise ValueError(f"Field '{field_name}' must be a valid date.")
    return parsed.to_pydatetime().date().isoformat()


def parse_boolean(value: object | None, *, default: bool = False) -> bool:
    if value in (None, ""):
        return default
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    return normalized in {"1", "true", "yes", "sim", "y"}
