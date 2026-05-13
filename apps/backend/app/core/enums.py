from enum import Enum


class AssetType(str, Enum):
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


class OperationType(str, Enum):
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


class OperationStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SETTLED = "settled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class CashflowEntryType(str, Enum):
    INFLOW = "inflow"
    OUTFLOW = "outflow"
    TRANSFER = "transfer"
    ADJUSTMENT = "adjustment"


class CashflowStatus(str, Enum):
    PENDING = "pending"
    SETTLED = "settled"
    CANCELLED = "cancelled"


class ReportTemplateType(str, Enum):
    CSV = "csv"
    XLSX = "xlsx"
    PDF = "pdf"


class ReportExecutionStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AuditAction(str, Enum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    ANALYST = "analyst"
    VIEWER = "viewer"
