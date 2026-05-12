import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.portfolios.schemas import PortfolioCreate, PortfolioRead, PortfolioUpdate
from app.modules.portfolios.service import (
    create_portfolio,
    delete_portfolio,
    get_portfolio_or_404,
    list_portfolios,
    update_portfolio,
)

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


@router.get("", response_model=list[PortfolioRead])
def read_portfolios(db: Session = Depends(get_db)) -> list[PortfolioRead]:
    return list_portfolios(db)


@router.post("", response_model=PortfolioRead, status_code=status.HTTP_201_CREATED)
def create_portfolio_endpoint(
    payload: PortfolioCreate,
    db: Session = Depends(get_db),
) -> PortfolioRead:
    return create_portfolio(db, payload)


@router.get("/{portfolio_id}", response_model=PortfolioRead)
def read_portfolio(portfolio_id: uuid.UUID, db: Session = Depends(get_db)) -> PortfolioRead:
    return get_portfolio_or_404(db, portfolio_id)


@router.put("/{portfolio_id}", response_model=PortfolioRead)
def update_portfolio_endpoint(
    portfolio_id: uuid.UUID,
    payload: PortfolioUpdate,
    db: Session = Depends(get_db),
) -> PortfolioRead:
    portfolio = get_portfolio_or_404(db, portfolio_id)
    return update_portfolio(db, portfolio, payload)


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio_endpoint(portfolio_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    portfolio = get_portfolio_or_404(db, portfolio_id)
    delete_portfolio(db, portfolio)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

