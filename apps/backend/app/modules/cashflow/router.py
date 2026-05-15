import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import DeleteAccessUser, ReadAccessUser, WriteAccessUser
from app.modules.cashflow.schemas import CashflowEntryCreate, CashflowEntryRead, CashflowEntryUpdate
from app.modules.cashflow.service import (
    create_cashflow_entry,
    delete_cashflow_entry,
    get_cashflow_entry_or_404,
    list_cashflow_entries,
    update_cashflow_entry,
)

router = APIRouter(prefix="/cashflow", tags=["cashflow"])


@router.get("", response_model=list[CashflowEntryRead])
def read_cashflow_entries(
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
    portfolio_id: uuid.UUID | None = Query(default=None),
) -> list[CashflowEntryRead]:
    return list_cashflow_entries(db, current_user=current_user, portfolio_id=portfolio_id)


@router.post("", response_model=CashflowEntryRead, status_code=status.HTTP_201_CREATED)
def create_cashflow_entry_endpoint(
    payload: CashflowEntryCreate,
    current_user: WriteAccessUser,
    db: Session = Depends(get_db),
) -> CashflowEntryRead:
    return create_cashflow_entry(db, payload, current_user=current_user, actor_user_id=current_user.id)


@router.get("/{entry_id}", response_model=CashflowEntryRead)
def read_cashflow_entry(
    entry_id: uuid.UUID,
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> CashflowEntryRead:
    return get_cashflow_entry_or_404(db, entry_id, current_user=current_user)


@router.put("/{entry_id}", response_model=CashflowEntryRead)
def update_cashflow_entry_endpoint(
    entry_id: uuid.UUID,
    payload: CashflowEntryUpdate,
    current_user: WriteAccessUser,
    db: Session = Depends(get_db),
) -> CashflowEntryRead:
    entry = get_cashflow_entry_or_404(db, entry_id, current_user=current_user)
    return update_cashflow_entry(
        db,
        entry,
        payload,
        current_user=current_user,
        actor_user_id=current_user.id,
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cashflow_entry_endpoint(
    entry_id: uuid.UUID,
    current_user: DeleteAccessUser,
    db: Session = Depends(get_db),
) -> Response:
    entry = get_cashflow_entry_or_404(db, entry_id, current_user=current_user)
    delete_cashflow_entry(db, entry, current_user=current_user, actor_user_id=current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
