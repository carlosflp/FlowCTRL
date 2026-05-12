import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.portfolios.models import Portfolio
from app.modules.portfolios.schemas import PortfolioCreate, PortfolioUpdate


def list_portfolios(db: Session) -> list[Portfolio]:
    return list(db.scalars(select(Portfolio).order_by(Portfolio.name)))


def get_portfolio_or_404(db: Session, portfolio_id: uuid.UUID) -> Portfolio:
    portfolio = db.get(Portfolio, portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found.")
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

