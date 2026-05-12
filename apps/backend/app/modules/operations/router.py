import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
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
def read_operations(db: Session = Depends(get_db)) -> list[OperationRead]:
    return list_operations(db)


@router.post("", response_model=OperationRead, status_code=status.HTTP_201_CREATED)
def create_operation_endpoint(
    payload: OperationCreate,
    db: Session = Depends(get_db),
) -> OperationRead:
    return create_operation(db, payload)


@router.get("/{operation_id}", response_model=OperationRead)
def read_operation(operation_id: uuid.UUID, db: Session = Depends(get_db)) -> OperationRead:
    return get_operation_or_404(db, operation_id)


@router.put("/{operation_id}", response_model=OperationRead)
def update_operation_endpoint(
    operation_id: uuid.UUID,
    payload: OperationUpdate,
    db: Session = Depends(get_db),
) -> OperationRead:
    operation = get_operation_or_404(db, operation_id)
    return update_operation(db, operation, payload)


@router.delete("/{operation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_operation_endpoint(operation_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    operation = get_operation_or_404(db, operation_id)
    delete_operation(db, operation)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
