from enum import StrEnum


class AssetType(StrEnum):
    CASH = "cash"
    STOCK = "stock"
    BOND = "bond"
    FUND = "fund"
    FIXED_INCOME = "fixed_income"
    DEBENTURE = "debenture"
    CRI = "cri"
    CRA = "cra"
    ETF = "etf"
    DERIVATIVE = "derivative"
    OTHER = "other"


class OperationType(StrEnum):
    BUY = "buy"
    SELL = "sell"
    CONTRIBUTION = "contribution"
    REDEMPTION = "redemption"
    DIVIDEND = "dividend"
    INTEREST = "interest"
    COUPON = "coupon"
    AMORTIZATION = "amortization"
    FEE = "fee"
    TAX = "tax"
    ADJUSTMENT = "adjustment"
    TRANSFER = "transfer"


class OperationStatus(StrEnum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SETTLED = "settled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class CashflowEntryType(StrEnum):
    INFLOW = "inflow"
    OUTFLOW = "outflow"
    TRANSFER = "transfer"
    ADJUSTMENT = "adjustment"


class CashflowStatus(StrEnum):
    PENDING = "pending"
    SETTLED = "settled"
    CANCELLED = "cancelled"


class ReportTemplateType(StrEnum):
    CSV = "csv"
    XLSX = "xlsx"
    PDF = "pdf"


class ReportDatasetType(StrEnum):
    OPERATIONS = "operations"
    CASHFLOW = "cashflow"
    PRICING = "pricing"
    PORTFOLIOS = "portfolios"


class ReportExecutionStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ImportDatasetType(StrEnum):
    OPERATIONS = "operations"
    CASHFLOW = "cashflow"
    PRICING = "pricing"


class ImportSourceType(StrEnum):
    MANUAL_UPLOAD = "manual_upload"
    ADMINISTRATOR_FILE = "administrator_file"
    CUSTODIAN_STATEMENT = "custodian_statement"
    BROKERAGE_NOTE = "brokerage_note"
    POSITION_FILE = "position_file"
    MOVEMENT_FILE = "movement_file"
    CASH_FILE = "cash_file"
    MARKET_REPORT = "market_report"
    INTERNAL_REPORT = "internal_report"
    API_INTEGRATION = "api_integration"
    AUTOMATED_EVENT = "automated_event"


class ImportJobStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    COMPLETED_WITH_ERRORS = "completed_with_errors"
    FAILED = "failed"


class AuditAction(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"


class UserRole(StrEnum):
    ADMIN = "admin"
    MANAGER = "manager"
    ANALYST = "analyst"
    VIEWER = "viewer"
