from __future__ import annotations

import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import AssetType, OperationStatus, OperationType
from app.modules.operations.models import Operation
from app.modules.portfolios.models import Portfolio
from app.modules.portfolios.service import (
    ensure_user_has_portfolio_access,
    get_accessible_portfolio_ids,
    user_has_global_portfolio_access,
)
from app.modules.positions.schemas import (
    PositionAssetSummary,
    PositionOverview,
    PositionPortfolioSummary,
    PositionRead,
)
from app.modules.pricing.models import AssetPrice
from app.modules.users.models import User

MONEY_QUANTIZER = Decimal("0.0001")
PERCENT_QUANTIZER = Decimal("0.00000001")
QUANTITY_QUANTIZER = Decimal("0.00000001")
MONEY_EPSILON = Decimal("0.0001")
QUANTITY_EPSILON = Decimal("0.00000001")

POSITION_INCREASING_OPERATION_TYPES = {
    OperationType.BUY,
    OperationType.CONTRIBUTION,
}
POSITION_DECREASING_OPERATION_TYPES = {
    OperationType.SELL,
    OperationType.REDEMPTION,
    OperationType.AMORTIZATION,
}
POSITION_RELEVANT_STATUSES = {
    OperationStatus.APPROVED,
    OperationStatus.SETTLED,
}


@dataclass
class PositionAccumulator:
    portfolio_id: uuid.UUID
    portfolio_name: str
    base_currency: str
    asset_id: uuid.UUID
    asset_ticker: str
    asset_name: str
    asset_type: AssetType
    quantity: Decimal = Decimal("0")
    total_cost_basis: Decimal = Decimal("0")
    last_trade_date: date | None = None
    operation_count: int = 0


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTIZER)


def _quantize_quantity(value: Decimal) -> Decimal:
    return value.quantize(QUANTITY_QUANTIZER)


def _quantize_percent(value: Decimal) -> Decimal:
    return value.quantize(PERCENT_QUANTIZER)


def _resolve_as_of_date(as_of_date: date | None) -> date:
    return as_of_date or date.today()


def _ensure_portfolio_exists_if_filtered(
    db: Session,
    *,
    current_user: User,
    portfolio_id: uuid.UUID | None,
) -> None:
    if portfolio_id is None:
        return
    ensure_user_has_portfolio_access(
        db,
        current_user=current_user,
        portfolio_id=portfolio_id,
    )


def _load_position_operations(
    db: Session,
    *,
    as_of_date: date,
    accessible_portfolio_ids: list[uuid.UUID] | None,
    portfolio_id: uuid.UUID | None = None,
) -> list[Operation]:
    statement = (
        select(Operation)
        .where(
            Operation.trade_date <= as_of_date,
            Operation.status.in_(POSITION_RELEVANT_STATUSES),
        )
        .options(selectinload(Operation.portfolio), selectinload(Operation.asset))
        .order_by(Operation.trade_date.asc(), Operation.created_at.asc())
    )

    if portfolio_id is not None:
        statement = statement.where(Operation.portfolio_id == portfolio_id)
    elif accessible_portfolio_ids is not None:
        if not accessible_portfolio_ids:
            return []
        statement = statement.where(Operation.portfolio_id.in_(accessible_portfolio_ids))

    return list(db.scalars(statement))


def _load_latest_prices(
    db: Session,
    *,
    asset_ids: Iterable[uuid.UUID],
    as_of_date: date,
) -> dict[uuid.UUID, AssetPrice]:
    asset_ids = list(asset_ids)
    if not asset_ids:
        return {}

    statement = (
        select(AssetPrice)
        .where(
            AssetPrice.asset_id.in_(asset_ids),
            AssetPrice.price_date <= as_of_date,
        )
        .order_by(
            AssetPrice.asset_id.asc(),
            AssetPrice.price_date.desc(),
            AssetPrice.is_validated.desc(),
            AssetPrice.created_at.desc(),
        )
    )

    latest_prices: dict[uuid.UUID, AssetPrice] = {}
    for price in db.scalars(statement):
        latest_prices.setdefault(price.asset_id, price)
    return latest_prices


def _apply_operation(accumulator: PositionAccumulator, operation: Operation) -> None:
    if operation.operation_type not in (
        POSITION_INCREASING_OPERATION_TYPES | POSITION_DECREASING_OPERATION_TYPES
    ):
        return

    accumulator.operation_count += 1
    accumulator.last_trade_date = operation.trade_date

    if operation.operation_type in POSITION_INCREASING_OPERATION_TYPES:
        accumulator.quantity += operation.quantity
        accumulator.total_cost_basis += operation.gross_value
        return

    average_cost = (
        accumulator.total_cost_basis / accumulator.quantity
        if abs(accumulator.quantity) >= QUANTITY_EPSILON
        else Decimal("0")
    )
    accumulator.quantity -= operation.quantity
    accumulator.total_cost_basis -= average_cost * operation.quantity


def _build_position_rows(
    operations: list[Operation],
    prices_by_asset: dict[uuid.UUID, AssetPrice],
    *,
    as_of_date: date,
) -> list[PositionRead]:
    grouped: dict[tuple[uuid.UUID, uuid.UUID], PositionAccumulator] = {}

    for operation in operations:
        key = (operation.portfolio_id, operation.asset_id)
        if key not in grouped:
            grouped[key] = PositionAccumulator(
                portfolio_id=operation.portfolio.id,
                portfolio_name=operation.portfolio.name,
                base_currency=operation.portfolio.base_currency,
                asset_id=operation.asset.id,
                asset_ticker=operation.asset.ticker,
                asset_name=operation.asset.name,
                asset_type=operation.asset.asset_type,
            )
        _apply_operation(grouped[key], operation)

    positions: list[PositionRead] = []
    for accumulator in grouped.values():
        if (
            abs(accumulator.quantity) < QUANTITY_EPSILON
            and abs(accumulator.total_cost_basis) < MONEY_EPSILON
        ):
            continue
        if accumulator.last_trade_date is None or accumulator.operation_count == 0:
            continue

        latest_price = prices_by_asset.get(accumulator.asset_id)
        quantity = _quantize_quantity(accumulator.quantity)
        total_cost_basis = _quantize_money(accumulator.total_cost_basis)
        average_cost = (
            _quantize_quantity(accumulator.total_cost_basis / accumulator.quantity)
            if abs(accumulator.quantity) >= QUANTITY_EPSILON
            else Decimal("0")
        )

        market_value: Decimal | None = None
        unrealized_pnl: Decimal | None = None
        unrealized_pnl_pct: Decimal | None = None

        if latest_price is not None:
            raw_market_value = latest_price.price * accumulator.quantity
            raw_unrealized_pnl = raw_market_value - accumulator.total_cost_basis
            market_value = _quantize_money(raw_market_value)
            unrealized_pnl = _quantize_money(raw_unrealized_pnl)
            if abs(accumulator.total_cost_basis) >= MONEY_EPSILON:
                unrealized_pnl_pct = _quantize_percent(
                    raw_unrealized_pnl / accumulator.total_cost_basis
                )

        positions.append(
            PositionRead(
                as_of_date=as_of_date,
                portfolio=PositionPortfolioSummary(
                    id=accumulator.portfolio_id,
                    name=accumulator.portfolio_name,
                    base_currency=accumulator.base_currency,
                ),
                asset=PositionAssetSummary(
                    id=accumulator.asset_id,
                    ticker=accumulator.asset_ticker,
                    name=accumulator.asset_name,
                    asset_type=accumulator.asset_type,
                ),
                quantity=quantity,
                average_cost=average_cost,
                total_cost_basis=total_cost_basis,
                latest_price=_quantize_money(latest_price.price) if latest_price else None,
                latest_price_date=latest_price.price_date if latest_price else None,
                price_source=latest_price.source if latest_price else None,
                is_price_validated=latest_price.is_validated if latest_price else None,
                market_value=market_value,
                unrealized_pnl=unrealized_pnl,
                unrealized_pnl_pct=unrealized_pnl_pct,
                last_trade_date=accumulator.last_trade_date,
                operation_count=accumulator.operation_count,
            )
        )

    return sorted(
        positions,
        key=lambda position: (
            position.portfolio.name.lower(),
            position.asset.ticker.lower(),
        ),
    )


def list_positions(
    db: Session,
    *,
    current_user: User,
    as_of_date: date | None = None,
    portfolio_id: uuid.UUID | None = None,
) -> list[PositionRead]:
    resolved_as_of_date = _resolve_as_of_date(as_of_date)
    _ensure_portfolio_exists_if_filtered(
        db,
        current_user=current_user,
        portfolio_id=portfolio_id,
    )
    accessible_portfolio_ids = (
        None
        if user_has_global_portfolio_access(current_user)
        else get_accessible_portfolio_ids(db, current_user)
    )

    operations = _load_position_operations(
        db,
        as_of_date=resolved_as_of_date,
        accessible_portfolio_ids=accessible_portfolio_ids,
        portfolio_id=portfolio_id,
    )
    prices_by_asset = _load_latest_prices(
        db,
        asset_ids={operation.asset_id for operation in operations},
        as_of_date=resolved_as_of_date,
    )

    return _build_position_rows(
        operations,
        prices_by_asset,
        as_of_date=resolved_as_of_date,
    )


def get_position_overview(
    db: Session,
    *,
    current_user: User,
    as_of_date: date | None = None,
    portfolio_id: uuid.UUID | None = None,
) -> PositionOverview:
    resolved_as_of_date = _resolve_as_of_date(as_of_date)
    positions = list_positions(
        db,
        current_user=current_user,
        as_of_date=resolved_as_of_date,
        portfolio_id=portfolio_id,
    )

    priced_positions = [position for position in positions if position.market_value is not None]
    total_positions = len(positions)
    total_cost_basis = _quantize_money(
        sum((position.total_cost_basis for position in positions), start=Decimal("0"))
    )
    total_market_value = _quantize_money(
        sum((position.market_value or Decimal("0") for position in positions), start=Decimal("0"))
    )
    total_unrealized_pnl = _quantize_money(
        sum((position.unrealized_pnl or Decimal("0") for position in positions), start=Decimal("0"))
    )
    coverage_ratio = (
        Decimal(len(priced_positions)) / Decimal(total_positions)
        if total_positions
        else Decimal("0")
    )
    pricing_coverage_pct = _quantize_percent(
        coverage_ratio
    )

    return PositionOverview(
        as_of_date=resolved_as_of_date,
        open_positions=total_positions,
        priced_positions=len(priced_positions),
        unpriced_positions=total_positions - len(priced_positions),
        total_cost_basis=total_cost_basis,
        total_market_value=total_market_value,
        total_unrealized_pnl=total_unrealized_pnl,
        pricing_coverage_pct=pricing_coverage_pct,
    )
