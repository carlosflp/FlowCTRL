import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import UserRole
from app.modules.portfolios.models import Portfolio
from app.modules.portfolios.schemas import PortfolioCreate, PortfolioUpdate
from app.modules.users.access import user_portfolio_access_table
from app.modules.users.models import User


def user_has_global_portfolio_access(user: User) -> bool:
    return user.is_superuser or user.role == UserRole.ADMIN


def list_portfolios(db: Session, current_user: User | None = None) -> list[Portfolio]:
    statement = select(Portfolio).order_by(Portfolio.name)
    if current_user is not None and not user_has_global_portfolio_access(current_user):
        statement = statement.join(
            user_portfolio_access_table,
            user_portfolio_access_table.c.portfolio_id == Portfolio.id,
        ).where(user_portfolio_access_table.c.user_id == current_user.id)
    return list(db.scalars(statement).unique())


def get_portfolio_or_404(db: Session, portfolio_id: uuid.UUID) -> Portfolio:
    portfolio = db.get(Portfolio, portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found.")
    return portfolio


def validate_portfolio_ids(db: Session, portfolio_ids: list[uuid.UUID]) -> list[Portfolio]:
    normalized_ids: list[uuid.UUID] = []
    seen_ids: set[uuid.UUID] = set()

    for portfolio_id in portfolio_ids:
        if portfolio_id in seen_ids:
            continue
        normalized_ids.append(portfolio_id)
        seen_ids.add(portfolio_id)

    if not normalized_ids:
        return []

    statement = select(Portfolio).where(Portfolio.id.in_(normalized_ids))
    portfolios = list(db.scalars(statement))
    portfolios_by_id = {portfolio.id: portfolio for portfolio in portfolios}
    missing_ids = [portfolio_id for portfolio_id in normalized_ids if portfolio_id not in portfolios_by_id]
    if missing_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found.")

    return [portfolios_by_id[portfolio_id] for portfolio_id in normalized_ids]


def replace_user_portfolio_access(
    db: Session,
    *,
    user: User,
    portfolio_ids: list[uuid.UUID],
) -> None:
    user.accessible_portfolios = validate_portfolio_ids(db, portfolio_ids)
    db.add(user)


def get_accessible_portfolio_ids(db: Session, current_user: User) -> list[uuid.UUID]:
    if user_has_global_portfolio_access(current_user):
        return list(db.scalars(select(Portfolio.id).order_by(Portfolio.name.asc())))

    statement = (
        select(Portfolio.id)
        .join(
            user_portfolio_access_table,
            user_portfolio_access_table.c.portfolio_id == Portfolio.id,
        )
        .where(user_portfolio_access_table.c.user_id == current_user.id)
        .order_by(Portfolio.name.asc())
    )
    return list(db.scalars(statement))


def ensure_user_has_portfolio_access(
    db: Session,
    *,
    current_user: User,
    portfolio_id: uuid.UUID,
) -> Portfolio:
    portfolio = get_portfolio_or_404(db, portfolio_id)
    if user_has_global_portfolio_access(current_user):
        return portfolio

    accessible_portfolio_ids = set(get_accessible_portfolio_ids(db, current_user))
    if portfolio_id not in accessible_portfolio_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this portfolio.",
        )
    return portfolio


def create_portfolio(db: Session, payload: PortfolioCreate) -> Portfolio:
    portfolio = Portfolio(**payload.model_dump())
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    return portfolio


def update_portfolio(db: Session, portfolio: Portfolio, payload: PortfolioUpdate) -> Portfolio:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(portfolio, field, value)
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    return portfolio


def delete_portfolio(db: Session, portfolio: Portfolio) -> None:
    db.delete(portfolio)
    db.commit()
