import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import DeleteAccessUser, ReadAccessUser, WriteAccessUser
from app.modules.operations.schemas import OperationCreate, OperationRead, OperationUpdate
from app.modules.operations.service import (
    create_operation,
    delete_operation,
    get_operation_or_404,
    list_operations,
    update_operation,
)

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get("", response_model=list[OperationRead])
def read_operations(
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> list[OperationRead]:
    return list_operations(db)


@router.post("", response_model=OperationRead, status_code=status.HTTP_201_CREATED)
def create_operation_endpoint(
    payload: OperationCreate,
    current_user: WriteAccessUser,
    db: Session = Depends(get_db),
) -> OperationRead:
    return create_operation(db, payload, actor_user_id=current_user.id)


@router.get("/{operation_id}", response_model=OperationRead)
def read_operation(
    operation_id: uuid.UUID,
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> OperationRead:
    return get_operation_or_404(db, operation_id)


@router.put("/{operation_id}", response_model=OperationRead)
def update_operation_endpoint(
    operation_id: uuid.UUID,
    payload: OperationUpdate,
    current_user: WriteAccessUser,
    db: Session = Depends(get_db),
) -> OperationRead:
    operation = get_operation_or_404(db, operation_id)
    return update_operation(db, operation, payload, actor_user_id=current_user.id)


@router.delete("/{operation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_operation_endpoint(
    operation_id: uuid.UUID,
    current_user: DeleteAccessUser,
    db: Session = Depends(get_db),
) -> Response:
    operation = get_operation_or_404(db, operation_id)
    delete_operation(db, operation, actor_user_id=current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
