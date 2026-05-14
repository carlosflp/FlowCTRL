from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import (
    AssetType,
    CashflowEntryType,
    CashflowStatus,
    OperationStatus,
    OperationType,
    ReportExecutionStatus,
    ReportTemplateType,
    UserRole,
)
from app.db.session import get_session_factory
from app.modules.assets.models import Asset
from app.modules.assets.schemas import AssetCreate, AssetUpdate
from app.modules.assets.service import create_asset, update_asset
from app.modules.cashflow.models import CashflowEntry
from app.modules.cashflow.schemas import CashflowEntryCreate, CashflowEntryUpdate
from app.modules.cashflow.service import create_cashflow_entry, update_cashflow_entry
from app.modules.operations.models import Operation
from app.modules.operations.schemas import OperationCreate, OperationUpdate
from app.modules.operations.service import create_operation, update_operation
from app.modules.portfolios.models import Portfolio
from app.modules.portfolios.schemas import PortfolioCreate, PortfolioUpdate
from app.modules.portfolios.service import create_portfolio, update_portfolio
from app.modules.positions.service import get_position_overview, list_positions
from app.modules.pricing.models import AssetPrice
from app.modules.pricing.schemas import AssetPriceCreate, AssetPriceUpdate
from app.modules.pricing.service import create_asset_price, update_asset_price
from app.modules.reports.models import ReportExecution, ReportTemplate
from app.modules.reports.schemas import (
    ReportExecutionCreate,
    ReportExecutionParameters,
    ReportTemplateCreate,
    ReportTemplateUpdate,
)
from app.modules.reports.service import (
    create_report_execution,
    create_report_template,
    ensure_default_report_templates,
    get_report_execution_or_404,
    process_report_execution_in_session,
    update_report_template,
)
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate, UserUpdate
from app.modules.users.service import (
    create_user_from_payload,
    ensure_admin_user,
    ensure_default_user,
    get_user_by_email,
    update_user,
)

DEMO_PREFIX = "Demo - "
REPORT_WAIT_TIMEOUT_SECONDS = 45


@dataclass(frozen=True)
class DemoOperationSeed:
    code: str
    portfolio: str
    asset: str
    operation_type: OperationType
    trade_date: date
    settlement_date: date
    quantity: Decimal
    unit_price: Decimal
    fees: Decimal
    taxes: Decimal
    status: OperationStatus
    notes: str


@dataclass(frozen=True)
class DemoCashflowSeed:
    code: str
    portfolio: str
    operation_code: str | None
    entry_date: date
    settlement_date: date
    description: str
    entry_type: CashflowEntryType
    amount: Decimal
    status: CashflowStatus


@dataclass(frozen=True)
class DemoPricingSeed:
    asset: str
    price_date: date
    price: Decimal
    source: str
    is_validated: bool


DEMO_USERS = (
    {
        "email": "manager.demo@flowctrl.local",
        "full_name": "Marina Gestora Demo",
        "password": "ManagerDemo123!",
        "role": UserRole.MANAGER,
        "is_active": True,
    },
    {
        "email": "analyst.demo@flowctrl.local",
        "full_name": "Andre Analista Demo",
        "password": "AnalystDemo123!",
        "role": UserRole.ANALYST,
        "is_active": True,
    },
    {
        "email": "viewer.ops.demo@flowctrl.local",
        "full_name": "Olivia Viewer Operacional",
        "password": "ViewerOps123!",
        "role": UserRole.VIEWER,
        "is_active": True,
    },
    {
        "email": "viewer.inactive.demo@flowctrl.local",
        "full_name": "Victor Viewer Inativo",
        "password": "ViewerInactive123!",
        "role": UserRole.VIEWER,
        "is_active": False,
    },
)

DEMO_PORTFOLIOS = (
    {
        "name": f"{DEMO_PREFIX}Alpha Liquidez",
        "description": "Carteira demo com foco em caixa e equities domesticas.",
        "base_currency": "BRL",
        "benchmark": "CDI",
        "is_active": True,
    },
    {
        "name": f"{DEMO_PREFIX}Beta Credito",
        "description": "Carteira demo com foco em credito privado e renda fixa.",
        "base_currency": "BRL",
        "benchmark": "IMA-B",
        "is_active": True,
    },
    {
        "name": f"{DEMO_PREFIX}Gamma Acoes",
        "description": "Carteira demo de risco com exposicao a bolsa e ETFs.",
        "base_currency": "BRL",
        "benchmark": "Ibovespa",
        "is_active": True,
    },
    {
        "name": f"{DEMO_PREFIX}Legacy Encerrado",
        "description": "Carteira encerrada para validar filtros e estados inativos.",
        "base_currency": "BRL",
        "benchmark": "CDI",
        "is_active": False,
    },
)

DEMO_ASSETS = (
    {
        "ticker": "DMO-PETR4",
        "name": "Demo Petrobras PN",
        "asset_type": AssetType.STOCK,
        "issuer": "Petrobras",
        "indexer": None,
        "maturity_date": None,
        "is_active": True,
    },
    {
        "ticker": "DMO-VALE3",
        "name": "Demo Vale ON",
        "asset_type": AssetType.STOCK,
        "issuer": "Vale",
        "indexer": None,
        "maturity_date": None,
        "is_active": True,
    },
    {
        "ticker": "DMO-NTNB35",
        "name": "Demo NTN-B 2035",
        "asset_type": AssetType.BOND,
        "issuer": "Tesouro Nacional",
        "indexer": "IPCA",
        "maturity_date": date(2035, 5, 15),
        "is_active": True,
    },
    {
        "ticker": "DMO-DEB31",
        "name": "Demo Debenture Energia 2031",
        "asset_type": AssetType.DEBENTURE,
        "issuer": "Energia Brasil",
        "indexer": "CDI",
        "maturity_date": date(2031, 9, 1),
        "is_active": True,
    },
    {
        "ticker": "DMO-BOVA11",
        "name": "Demo ETF Bovespa",
        "asset_type": AssetType.ETF,
        "issuer": "Gestora ETF",
        "indexer": "Ibovespa",
        "maturity_date": None,
        "is_active": True,
    },
    {
        "ticker": "DMO-FIDC01",
        "name": "Demo FIDC Recebiveis",
        "asset_type": AssetType.FUND,
        "issuer": "Gestora Credito",
        "indexer": "CDI",
        "maturity_date": None,
        "is_active": True,
    },
    {
        "ticker": "DMO-CRA29",
        "name": "Demo CRA Agro 2029",
        "asset_type": AssetType.CRA,
        "issuer": "Agro Trading",
        "indexer": "IPCA",
        "maturity_date": date(2029, 8, 20),
        "is_active": False,
    },
)

DEMO_OPERATIONS = (
    DemoOperationSeed(
        code="OPS-001",
        portfolio=f"{DEMO_PREFIX}Alpha Liquidez",
        asset="DMO-PETR4",
        operation_type=OperationType.BUY,
        trade_date=date(2026, 1, 10),
        settlement_date=date(2026, 1, 13),
        quantity=Decimal("100"),
        unit_price=Decimal("100"),
        fees=Decimal("10"),
        taxes=Decimal("0"),
        status=OperationStatus.APPROVED,
        notes="[DEMO:OPS-001] Compra base de PETR4 para formar posicao inicial.",
    ),
    DemoOperationSeed(
        code="OPS-002",
        portfolio=f"{DEMO_PREFIX}Alpha Liquidez",
        asset="DMO-PETR4",
        operation_type=OperationType.BUY,
        trade_date=date(2026, 2, 14),
        settlement_date=date(2026, 2, 17),
        quantity=Decimal("50"),
        unit_price=Decimal("108"),
        fees=Decimal("8"),
        taxes=Decimal("2"),
        status=OperationStatus.SETTLED,
        notes="[DEMO:OPS-002] Reforco de posicao em PETR4.",
    ),
    DemoOperationSeed(
        code="OPS-003",
        portfolio=f"{DEMO_PREFIX}Alpha Liquidez",
        asset="DMO-PETR4",
        operation_type=OperationType.SELL,
        trade_date=date(2026, 4, 2),
        settlement_date=date(2026, 4, 4),
        quantity=Decimal("40"),
        unit_price=Decimal("122"),
        fees=Decimal("6"),
        taxes=Decimal("1"),
        status=OperationStatus.SETTLED,
        notes="[DEMO:OPS-003] Realizacao parcial de lucro em PETR4.",
    ),
    DemoOperationSeed(
        code="OPS-004",
        portfolio=f"{DEMO_PREFIX}Beta Credito",
        asset="DMO-NTNB35",
        operation_type=OperationType.CONTRIBUTION,
        trade_date=date(2026, 1, 20),
        settlement_date=date(2026, 1, 20),
        quantity=Decimal("200"),
        unit_price=Decimal("98"),
        fees=Decimal("0"),
        taxes=Decimal("0"),
        status=OperationStatus.APPROVED,
        notes="[DEMO:OPS-004] Aporte de NTN-B 2035 na carteira de credito.",
    ),
    DemoOperationSeed(
        code="OPS-005",
        portfolio=f"{DEMO_PREFIX}Beta Credito",
        asset="DMO-NTNB35",
        operation_type=OperationType.AMORTIZATION,
        trade_date=date(2026, 3, 25),
        settlement_date=date(2026, 3, 26),
        quantity=Decimal("40"),
        unit_price=Decimal("100"),
        fees=Decimal("0"),
        taxes=Decimal("0"),
        status=OperationStatus.SETTLED,
        notes="[DEMO:OPS-005] Amortizacao parcial do titulo indexado ao IPCA.",
    ),
    DemoOperationSeed(
        code="OPS-006",
        portfolio=f"{DEMO_PREFIX}Gamma Acoes",
        asset="DMO-VALE3",
        operation_type=OperationType.BUY,
        trade_date=date(2026, 2, 10),
        settlement_date=date(2026, 2, 12),
        quantity=Decimal("80"),
        unit_price=Decimal("65"),
        fees=Decimal("5"),
        taxes=Decimal("0"),
        status=OperationStatus.APPROVED,
        notes="[DEMO:OPS-006] Compra tática de VALE3 para a carteira de acoes.",
    ),
    DemoOperationSeed(
        code="OPS-007",
        portfolio=f"{DEMO_PREFIX}Gamma Acoes",
        asset="DMO-BOVA11",
        operation_type=OperationType.BUY,
        trade_date=date(2026, 5, 5),
        settlement_date=date(2026, 5, 7),
        quantity=Decimal("30"),
        unit_price=Decimal("118"),
        fees=Decimal("3"),
        taxes=Decimal("0"),
        status=OperationStatus.PENDING_APPROVAL,
        notes="[DEMO:OPS-007] ETF aguardando aprovacao interna.",
    ),
    DemoOperationSeed(
        code="OPS-008",
        portfolio=f"{DEMO_PREFIX}Gamma Acoes",
        asset="DMO-DEB31",
        operation_type=OperationType.BUY,
        trade_date=date(2026, 3, 11),
        settlement_date=date(2026, 3, 13),
        quantity=Decimal("120"),
        unit_price=Decimal("10"),
        fees=Decimal("0"),
        taxes=Decimal("0"),
        status=OperationStatus.SETTLED,
        notes="[DEMO:OPS-008] Debenture sem preco para validar posicao sem marcacao.",
    ),
    DemoOperationSeed(
        code="OPS-009",
        portfolio=f"{DEMO_PREFIX}Beta Credito",
        asset="DMO-FIDC01",
        operation_type=OperationType.CONTRIBUTION,
        trade_date=date(2026, 1, 8),
        settlement_date=date(2026, 1, 8),
        quantity=Decimal("150"),
        unit_price=Decimal("95"),
        fees=Decimal("0"),
        taxes=Decimal("0"),
        status=OperationStatus.APPROVED,
        notes="[DEMO:OPS-009] Aporte em FIDC para diversificar credito.",
    ),
    DemoOperationSeed(
        code="OPS-010",
        portfolio=f"{DEMO_PREFIX}Beta Credito",
        asset="DMO-FIDC01",
        operation_type=OperationType.REDEMPTION,
        trade_date=date(2026, 5, 2),
        settlement_date=date(2026, 5, 5),
        quantity=Decimal("20"),
        unit_price=Decimal("97"),
        fees=Decimal("0"),
        taxes=Decimal("0"),
        status=OperationStatus.DRAFT,
        notes="[DEMO:OPS-010] Resgate ainda em rascunho para teste operacional.",
    ),
    DemoOperationSeed(
        code="OPS-011",
        portfolio=f"{DEMO_PREFIX}Alpha Liquidez",
        asset="DMO-PETR4",
        operation_type=OperationType.DIVIDEND,
        trade_date=date(2026, 4, 30),
        settlement_date=date(2026, 5, 2),
        quantity=Decimal("1"),
        unit_price=Decimal("350"),
        fees=Decimal("0"),
        taxes=Decimal("15"),
        status=OperationStatus.SETTLED,
        notes="[DEMO:OPS-011] Provento recebido de PETR4.",
    ),
    DemoOperationSeed(
        code="OPS-012",
        portfolio=f"{DEMO_PREFIX}Beta Credito",
        asset="DMO-NTNB35",
        operation_type=OperationType.FEE,
        trade_date=date(2026, 5, 1),
        settlement_date=date(2026, 5, 1),
        quantity=Decimal("1"),
        unit_price=Decimal("50"),
        fees=Decimal("0"),
        taxes=Decimal("0"),
        status=OperationStatus.DRAFT,
        notes="[DEMO:OPS-012] Taxa operacional em rascunho.",
    ),
    DemoOperationSeed(
        code="OPS-013",
        portfolio=f"{DEMO_PREFIX}Legacy Encerrado",
        asset="DMO-CRA29",
        operation_type=OperationType.REDEMPTION,
        trade_date=date(2026, 2, 5),
        settlement_date=date(2026, 2, 6),
        quantity=Decimal("10"),
        unit_price=Decimal("100"),
        fees=Decimal("0"),
        taxes=Decimal("0"),
        status=OperationStatus.CANCELLED,
        notes="[DEMO:OPS-013] Resgate cancelado de carteira encerrada.",
    ),
    DemoOperationSeed(
        code="OPS-014",
        portfolio=f"{DEMO_PREFIX}Alpha Liquidez",
        asset="DMO-VALE3",
        operation_type=OperationType.TRANSFER,
        trade_date=date(2026, 5, 8),
        settlement_date=date(2026, 5, 9),
        quantity=Decimal("10"),
        unit_price=Decimal("66"),
        fees=Decimal("0"),
        taxes=Decimal("0"),
        status=OperationStatus.REJECTED,
        notes="[DEMO:OPS-014] Transferencia rejeitada por conferencia interna.",
    ),
)

DEMO_CASHFLOWS = (
    DemoCashflowSeed(
        code="CF-001",
        portfolio=f"{DEMO_PREFIX}Alpha Liquidez",
        operation_code=None,
        entry_date=date(2026, 1, 5),
        settlement_date=date(2026, 1, 5),
        description="[DEMO:CF-001] Aporte inicial de caixa da carteira Alpha.",
        entry_type=CashflowEntryType.INFLOW,
        amount=Decimal("500000"),
        status=CashflowStatus.SETTLED,
    ),
    DemoCashflowSeed(
        code="CF-002",
        portfolio=f"{DEMO_PREFIX}Alpha Liquidez",
        operation_code="OPS-001",
        entry_date=date(2026, 1, 10),
        settlement_date=date(2026, 1, 13),
        description="[DEMO:CF-002] Liquidacao da compra inicial de PETR4.",
        entry_type=CashflowEntryType.OUTFLOW,
        amount=Decimal("10010"),
        status=CashflowStatus.SETTLED,
    ),
    DemoCashflowSeed(
        code="CF-003",
        portfolio=f"{DEMO_PREFIX}Alpha Liquidez",
        operation_code="OPS-003",
        entry_date=date(2026, 4, 2),
        settlement_date=date(2026, 4, 4),
        description="[DEMO:CF-003] Liquidacao da venda parcial de PETR4.",
        entry_type=CashflowEntryType.INFLOW,
        amount=Decimal("4873"),
        status=CashflowStatus.SETTLED,
    ),
    DemoCashflowSeed(
        code="CF-004",
        portfolio=f"{DEMO_PREFIX}Beta Credito",
        operation_code=None,
        entry_date=date(2026, 5, 3),
        settlement_date=date(2026, 5, 6),
        description="[DEMO:CF-004] Cupom a receber de ativos de credito.",
        entry_type=CashflowEntryType.INFLOW,
        amount=Decimal("12500"),
        status=CashflowStatus.PENDING,
    ),
    DemoCashflowSeed(
        code="CF-005",
        portfolio=f"{DEMO_PREFIX}Gamma Acoes",
        operation_code=None,
        entry_date=date(2026, 4, 15),
        settlement_date=date(2026, 4, 15),
        description="[DEMO:CF-005] Transferencia entre contas de custodia.",
        entry_type=CashflowEntryType.TRANSFER,
        amount=Decimal("25000"),
        status=CashflowStatus.SETTLED,
    ),
    DemoCashflowSeed(
        code="CF-006",
        portfolio=f"{DEMO_PREFIX}Legacy Encerrado",
        operation_code=None,
        entry_date=date(2026, 2, 7),
        settlement_date=date(2026, 2, 7),
        description="[DEMO:CF-006] Ajuste cancelado da carteira encerrada.",
        entry_type=CashflowEntryType.ADJUSTMENT,
        amount=Decimal("1800"),
        status=CashflowStatus.CANCELLED,
    ),
    DemoCashflowSeed(
        code="CF-007",
        portfolio=f"{DEMO_PREFIX}Beta Credito",
        operation_code="OPS-009",
        entry_date=date(2026, 1, 8),
        settlement_date=date(2026, 1, 8),
        description="[DEMO:CF-007] Aporte financeiro do FIDC.",
        entry_type=CashflowEntryType.OUTFLOW,
        amount=Decimal("14250"),
        status=CashflowStatus.SETTLED,
    ),
)

DEMO_PRICES = (
    DemoPricingSeed("DMO-PETR4", date(2026, 5, 10), Decimal("125.40"), "b3", True),
    DemoPricingSeed("DMO-PETR4", date(2026, 5, 10), Decimal("125.15"), "vendor_prelim", False),
    DemoPricingSeed("DMO-PETR4", date(2026, 5, 11), Decimal("126.80"), "b3", True),
    DemoPricingSeed("DMO-VALE3", date(2026, 5, 11), Decimal("69.70"), "b3", True),
    DemoPricingSeed("DMO-VALE3", date(2026, 5, 9), Decimal("67.90"), "vendor_prelim", False),
    DemoPricingSeed("DMO-NTNB35", date(2026, 5, 11), Decimal("101.23"), "anbima", True),
    DemoPricingSeed("DMO-NTNB35", date(2026, 5, 8), Decimal("100.88"), "vendor_prelim", False),
    DemoPricingSeed("DMO-BOVA11", date(2026, 5, 11), Decimal("121.10"), "b3", False),
    DemoPricingSeed("DMO-FIDC01", date(2026, 5, 11), Decimal("99.40"), "admin_book", True),
)

DEMO_REPORT_TEMPLATES = (
    {
        "name": f"{DEMO_PREFIX}Carteiras Operacionais",
        "description": "Template demo para exportar a base de carteiras operacionais em qualquer formato.",
        "template_type": ReportTemplateType.XLSX,
        "config_json": {"dataset": "portfolios"},
        "is_active": True,
    },
    {
        "name": f"{DEMO_PREFIX}Operacoes Gerenciais",
        "description": "Template demo para analise operacional com exportacao configuravel.",
        "template_type": ReportTemplateType.PDF,
        "config_json": {"dataset": "operations"},
        "is_active": True,
    },
    {
        "name": f"{DEMO_PREFIX}Template Inativo",
        "description": "Template demo inativo para validar restricao operacional.",
        "template_type": ReportTemplateType.CSV,
        "config_json": {"dataset": "cashflow"},
        "is_active": False,
    },
)

DEMO_REPORT_EXECUTIONS = (
    {
        "template_name": "Operacoes Consolidadas",
        "portfolio_name": f"{DEMO_PREFIX}Alpha Liquidez",
        "file_type": "csv",
        "parameters": {
            "date_from": "2026-01-01",
            "date_to": "2026-05-31",
            "columns": ["trade_date", "portfolio", "asset", "operation_type", "status", "net_value"],
        },
    },
    {
        "template_name": "Movimentacoes de Caixa",
        "portfolio_name": f"{DEMO_PREFIX}Beta Credito",
        "file_type": "pdf",
        "parameters": {
            "date_from": "2026-01-01",
            "date_to": "2026-05-31",
            "columns": ["settlement_date", "portfolio", "description", "entry_type", "amount", "status"],
        },
    },
    {
        "template_name": "Precos de Ativos",
        "portfolio_name": None,
        "file_type": "csv",
        "parameters": {
            "date_from": "2026-05-08",
            "date_to": "2026-05-11",
            "columns": ["price_date", "asset", "price", "source", "is_validated"],
        },
    },
    {
        "template_name": f"{DEMO_PREFIX}Carteiras Operacionais",
        "portfolio_name": None,
        "file_type": "xlsx",
        "parameters": None,
    },
    {
        "template_name": f"{DEMO_PREFIX}Operacoes Gerenciais",
        "portfolio_name": f"{DEMO_PREFIX}Gamma Acoes",
        "file_type": "pdf",
        "parameters": {
            "date_from": "2026-02-01",
            "date_to": "2026-05-31",
            "columns": ["trade_date", "portfolio", "asset", "quantity", "status", "notes"],
        },
    },
)


def upsert_user(db: Session, admin_user: User, payload_data: dict[str, object]) -> User:
    email = str(payload_data["email"])
    existing = get_user_by_email(db, email)
    role = payload_data["role"]
    is_active = bool(payload_data["is_active"])
    is_superuser = role == UserRole.ADMIN

    if existing is None:
        payload = UserCreate(
            email=email,
            full_name=str(payload_data["full_name"]),
            password=str(payload_data["password"]),
            role=role,
            is_active=is_active,
            is_superuser=is_superuser,
        )
        return create_user_from_payload(db, payload=payload, actor_user=admin_user)

    update_payload = UserUpdate(
        email=email,
        full_name=str(payload_data["full_name"]),
        password=str(payload_data["password"]),
        role=role,
        is_active=is_active,
        is_superuser=is_superuser,
    )
    return update_user(
        db,
        user=existing,
        payload=update_payload,
        actor_user=admin_user,
        enforce_self_admin_protection=False,
    )


def upsert_portfolio(db: Session, payload_data: dict[str, object]) -> Portfolio:
    existing = db.scalar(select(Portfolio).where(Portfolio.name == payload_data["name"]))
    if existing is None:
        return create_portfolio(db, PortfolioCreate(**payload_data))
    return update_portfolio(db, existing, PortfolioUpdate(**payload_data))


def upsert_asset(db: Session, payload_data: dict[str, object]) -> Asset:
    existing = db.scalar(select(Asset).where(Asset.ticker == payload_data["ticker"]))
    if existing is None:
        return create_asset(db, AssetCreate(**payload_data))
    return update_asset(db, existing, AssetUpdate(**payload_data))


def upsert_operation(
    db: Session,
    seed: DemoOperationSeed,
    portfolio_id: uuid.UUID,
    asset_id: uuid.UUID,
) -> Operation:
    existing = db.scalar(select(Operation).where(Operation.notes == seed.notes))
    payload = OperationCreate(
        portfolio_id=portfolio_id,
        asset_id=asset_id,
        operation_type=seed.operation_type,
        trade_date=seed.trade_date,
        settlement_date=seed.settlement_date,
        quantity=seed.quantity,
        unit_price=seed.unit_price,
        fees=seed.fees,
        taxes=seed.taxes,
        status=seed.status,
        notes=seed.notes,
    )

    if existing is None:
        return create_operation(db, payload)

    return update_operation(
        db,
        existing,
        OperationUpdate(**payload.model_dump(exclude_none=True)),
    )


def upsert_cashflow_entry(
    db: Session,
    seed: DemoCashflowSeed,
    portfolio_id: uuid.UUID,
    operation_id: uuid.UUID | None,
) -> CashflowEntry:
    existing = db.scalar(select(CashflowEntry).where(CashflowEntry.description == seed.description))
    payload = CashflowEntryCreate(
        portfolio_id=portfolio_id,
        operation_id=operation_id,
        entry_date=seed.entry_date,
        settlement_date=seed.settlement_date,
        description=seed.description,
        entry_type=seed.entry_type,
        amount=seed.amount,
        status=seed.status,
    )

    if existing is None:
        return create_cashflow_entry(db, payload)

    return update_cashflow_entry(
        db,
        existing,
        CashflowEntryUpdate(**payload.model_dump()),
    )


def upsert_asset_price(
    db: Session,
    seed: DemoPricingSeed,
    asset_id: uuid.UUID,
) -> AssetPrice:
    existing = db.scalar(
        select(AssetPrice).where(
            and_(
                AssetPrice.asset_id == asset_id,
                AssetPrice.price_date == seed.price_date,
                AssetPrice.source == seed.source,
            )
        )
    )
    payload = AssetPriceCreate(
        asset_id=asset_id,
        price_date=seed.price_date,
        price=seed.price,
        source=seed.source,
        is_validated=seed.is_validated,
    )

    if existing is None:
        return create_asset_price(db, payload)

    return update_asset_price(
        db,
        existing,
        AssetPriceUpdate(**payload.model_dump()),
    )


def upsert_report_template(db: Session, payload_data: dict[str, object]) -> ReportTemplate:
    existing = db.scalar(select(ReportTemplate).where(ReportTemplate.name == payload_data["name"]))
    if existing is None:
        return create_report_template(db, ReportTemplateCreate(**payload_data))
    return update_report_template(db, existing, ReportTemplateUpdate(**payload_data))


def normalize_parameters(parameters: dict[str, object] | None) -> dict | None:
    if parameters is None:
        return None
    parsed = ReportExecutionParameters.model_validate(parameters)
    normalized = parsed.model_dump(mode="json", exclude_none=True)
    return normalized or None


def ensure_report_execution(
    db: Session,
    *,
    template: ReportTemplate,
    portfolio_id: uuid.UUID | None,
    file_type: str,
    parameters: dict[str, object] | None,
) -> ReportExecution:
    normalized_parameters = normalize_parameters(parameters)
    existing_executions = list(
        db.scalars(
            select(ReportExecution)
            .where(ReportExecution.template_id == template.id)
            .order_by(ReportExecution.created_at.desc())
        )
    )

    for execution in existing_executions:
        if execution.portfolio_id != portfolio_id:
            continue
        if execution.file_type != file_type:
            continue
        if (execution.parameters_json or None) != normalized_parameters:
            continue
        return execution

    payload = ReportExecutionCreate(
        template_id=template.id,
        portfolio_id=portfolio_id,
        file_type=file_type,
        parameters_json=normalized_parameters,
    )
    return create_report_execution(db, payload)


def wait_for_report_executions(db: Session, execution_ids: list[uuid.UUID]) -> dict[str, str]:
    statuses: dict[str, str] = {}
    deadline = time.monotonic() + REPORT_WAIT_TIMEOUT_SECONDS

    while time.monotonic() < deadline:
        db.expire_all()
        pending = False
        for execution_id in execution_ids:
            execution = get_report_execution_or_404(db, execution_id)
            statuses[str(execution_id)] = execution.status.value
            if execution.status in {ReportExecutionStatus.QUEUED, ReportExecutionStatus.RUNNING}:
                pending = True

        if not pending:
            return statuses
        time.sleep(1)

    db.expire_all()
    for execution_id in execution_ids:
        execution = get_report_execution_or_404(db, execution_id)
        statuses[str(execution_id)] = execution.status.value
        if execution.status in {ReportExecutionStatus.QUEUED, ReportExecutionStatus.RUNNING}:
            process_report_execution_in_session(db, execution_id)
            refreshed = get_report_execution_or_404(db, execution_id)
            statuses[str(execution_id)] = refreshed.status.value

    return statuses


def main() -> None:
    settings = get_settings()
    db = get_session_factory()()

    try:
        admin_user = ensure_admin_user(db, settings)
        default_viewer = ensure_default_user(db, settings)
        ensure_default_report_templates(db)

        demo_users = {
            str(user_data["email"]): upsert_user(db, admin_user, user_data)
            for user_data in DEMO_USERS
        }

        portfolios = {
            str(portfolio_data["name"]): upsert_portfolio(db, portfolio_data)
            for portfolio_data in DEMO_PORTFOLIOS
        }
        assets = {
            str(asset_data["ticker"]): upsert_asset(db, asset_data)
            for asset_data in DEMO_ASSETS
        }

        operations = {}
        for seed in DEMO_OPERATIONS:
            operations[seed.code] = upsert_operation(
                db,
                seed,
                portfolio_id=portfolios[seed.portfolio].id,
                asset_id=assets[seed.asset].id,
            )

        cashflows = {
            seed.code: upsert_cashflow_entry(
                db,
                seed,
                portfolio_id=portfolios[seed.portfolio].id,
                operation_id=operations[seed.operation_code].id if seed.operation_code else None,
            )
            for seed in DEMO_CASHFLOWS
        }

        prices = {
            f"{seed.asset}:{seed.price_date.isoformat()}:{seed.source}": upsert_asset_price(
                db,
                seed,
                asset_id=assets[seed.asset].id,
            )
            for seed in DEMO_PRICES
        }

        report_templates = {
            template_data["name"]: upsert_report_template(db, template_data)
            for template_data in DEMO_REPORT_TEMPLATES
        }

        execution_ids: list[uuid.UUID] = []
        for execution_seed in DEMO_REPORT_EXECUTIONS:
            template_name = str(execution_seed["template_name"])
            template = report_templates.get(template_name) or db.scalar(
                select(ReportTemplate).where(ReportTemplate.name == template_name)
            )
            if template is None:
                raise RuntimeError(f"Report template not found during demo seed: {template_name}")

            portfolio_name = execution_seed["portfolio_name"]
            portfolio_id = portfolios[portfolio_name].id if portfolio_name else None
            execution = ensure_report_execution(
                db,
                template=template,
                portfolio_id=portfolio_id,
                file_type=str(execution_seed["file_type"]),
                parameters=execution_seed["parameters"],
            )
            execution_ids.append(execution.id)

        report_statuses = wait_for_report_executions(db, execution_ids)

        positions = list_positions(db)
        position_overview = get_position_overview(db)

        summary = {
            "users": {
                "admin": settings.app_admin_email,
                "default_viewer": settings.app_default_user_email if default_viewer else None,
                "demo_accounts": {
                    email: {
                        "role": user.role.value,
                        "is_active": user.is_active,
                    }
                    for email, user in demo_users.items()
                },
            },
            "counts": {
                "portfolios": len(portfolios),
                "assets": len(assets),
                "operations": len(operations),
                "cashflow_entries": len(cashflows),
                "asset_prices": len(prices),
                "demo_report_templates": len(report_templates),
                "report_executions_tracked": len(execution_ids),
                "positions": len(positions),
            },
            "positions_overview": {
                "open_positions": position_overview.open_positions,
                "priced_positions": position_overview.priced_positions,
                "unpriced_positions": position_overview.unpriced_positions,
                "total_market_value": str(position_overview.total_market_value),
                "total_unrealized_pnl": str(position_overview.total_unrealized_pnl),
            },
            "report_execution_statuses": report_statuses,
            "credentials": {
                "admin": {
                    "email": settings.app_admin_email,
                    "password": settings.app_admin_password,
                },
                "viewer": {
                    "email": settings.app_default_user_email,
                    "password": settings.app_default_user_password,
                },
                "manager_demo": {
                    "email": "manager.demo@flowctrl.local",
                    "password": "ManagerDemo123!",
                },
                "analyst_demo": {
                    "email": "analyst.demo@flowctrl.local",
                    "password": "AnalystDemo123!",
                },
                "viewer_demo": {
                    "email": "viewer.ops.demo@flowctrl.local",
                    "password": "ViewerOps123!",
                },
            },
        }

        print(json.dumps(summary, indent=2, sort_keys=True, default=str))
    finally:
        db.close()


if __name__ == "__main__":
    main()
