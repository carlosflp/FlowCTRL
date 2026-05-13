import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import ReadAccessUser
from app.modules.positions.schemas import PositionOverview, PositionRead
from app.modules.positions.service import get_position_overview, list_positions

router = APIRouter(prefix="/positions", tags=["positions"])


@router.get("", response_model=list[PositionRead])
def read_positions(
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
    as_of_date: date | None = Query(default=None),
    portfolio_id: uuid.UUID | None = Query(default=None),
) -> list[PositionRead]:
    try:
        return list_positions(db, as_of_date=as_of_date, portfolio_id=portfolio_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/overview", response_model=PositionOverview)
def read_position_overview(
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
    as_of_date: date | None = Query(default=None),
    portfolio_id: uuid.UUID | None = Query(default=None),
) -> PositionOverview:
    try:
        return get_position_overview(db, as_of_date=as_of_date, portfolio_id=portfolio_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
