import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import AdminAccessUser
from app.modules.users.schemas import UserCreate, UserRead, UserUpdate
from app.modules.users.service import (
    build_user_read,
    create_user_from_payload,
    get_user_or_404,
    list_users,
    update_user,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def read_users(
    current_user: AdminAccessUser,
    db: Session = Depends(get_db),
) -> list[UserRead]:
    return [build_user_read(db, user) for user in list_users(db)]


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user_endpoint(
    payload: UserCreate,
    current_user: AdminAccessUser,
    db: Session = Depends(get_db),
) -> UserRead:
    user = create_user_from_payload(db, payload=payload, actor_user=current_user)
    return build_user_read(db, user)


@router.get("/{user_id}", response_model=UserRead)
def read_user(
    user_id: uuid.UUID,
    current_user: AdminAccessUser,
    db: Session = Depends(get_db),
) -> UserRead:
    user = get_user_or_404(db, user_id)
    return build_user_read(db, user)


@router.put("/{user_id}", response_model=UserRead)
def update_user_endpoint(
    user_id: uuid.UUID,
    payload: UserUpdate,
    current_user: AdminAccessUser,
    db: Session = Depends(get_db),
) -> UserRead:
    user = get_user_or_404(db, user_id)
    updated_user = update_user(db, user=user, payload=payload, actor_user=current_user)
    return build_user_read(db, updated_user)
