from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.enums import AuditAction, UserRole
from app.core.security import get_password_hash
from app.modules.audit.service import create_audit_log
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate, UserRead, UserUpdate


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    statement = select(User).where(User.email == normalize_email(email))
    return db.scalar(statement)


def list_users(db: Session) -> list[User]:
    statement = select(User).order_by(User.created_at.desc(), User.email.asc())
    return list(db.scalars(statement))


def get_user_or_404(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


def _serialize_user_for_audit(user: User) -> dict:
    return UserRead.model_validate(user).model_dump(mode="json")


def _ensure_unique_email(
    db: Session,
    *,
    email: str,
    ignore_user_id: uuid.UUID | None = None,
) -> str:
    normalized_email = normalize_email(email)
    statement = select(User.id).where(User.email == normalized_email)
    if ignore_user_id is not None:
        statement = statement.where(User.id != ignore_user_id)

    if db.scalar(statement) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )
    return normalized_email


def _resolve_role_and_superuser(
    *,
    role: UserRole,
    is_superuser: bool,
) -> tuple[UserRole, bool]:
    if role == UserRole.ADMIN:
        return UserRole.ADMIN, True
    if is_superuser:
        return UserRole.ADMIN, True
    return role, False


def _is_effective_admin(*, role: UserRole, is_superuser: bool, is_active: bool) -> bool:
    return is_active and (is_superuser or role == UserRole.ADMIN)


def _count_active_admin_users(db: Session) -> int:
    statement = select(func.count()).select_from(User).where(
        User.is_active.is_(True),
        or_(User.is_superuser.is_(True), User.role == UserRole.ADMIN),
    )
    return int(db.scalar(statement) or 0)


def create_user(
    db: Session,
    *,
    email: str,
    full_name: str,
    password: str,
    role: UserRole,
    is_active: bool = True,
    is_superuser: bool = False,
) -> User:
    user = User(
        email=normalize_email(email),
        full_name=full_name,
        hashed_password=get_password_hash(password),
        role=role,
        is_active=is_active,
        is_superuser=is_superuser or role == UserRole.ADMIN,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_user_from_payload(
    db: Session,
    *,
    payload: UserCreate,
    actor_user: User,
) -> User:
    normalized_email = _ensure_unique_email(db, email=payload.email)
    role, is_superuser = _resolve_role_and_superuser(
        role=payload.role,
        is_superuser=payload.is_superuser,
    )

    user = User(
        email=normalized_email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=role,
        is_active=payload.is_active,
        is_superuser=is_superuser,
    )
    db.add(user)
    db.flush()
    create_audit_log(
        db,
        entity_type="user",
        entity_id=str(user.id),
        action=AuditAction.CREATED,
        new_value=_serialize_user_for_audit(user),
        user_id=actor_user.id,
    )
    db.commit()
    db.refresh(user)
    return user


def update_user(
    db: Session,
    *,
    user: User,
    payload: UserUpdate,
    actor_user: User,
) -> User:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return user

    old_value = _serialize_user_for_audit(user)
    new_email = user.email
    if "email" in updates and updates["email"] is not None:
        new_email = _ensure_unique_email(db, email=updates["email"], ignore_user_id=user.id)

    new_role = updates.get("role", user.role)
    new_is_superuser = updates.get("is_superuser", user.is_superuser)
    new_role, new_is_superuser = _resolve_role_and_superuser(
        role=new_role,
        is_superuser=new_is_superuser,
    )
    new_is_active = updates.get("is_active", user.is_active)

    if user.id == actor_user.id and (
        not new_is_active or not new_is_superuser or new_role != UserRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own administrative access from this screen.",
        )

    if _is_effective_admin(
        role=user.role,
        is_superuser=user.is_superuser,
        is_active=user.is_active,
    ) and not _is_effective_admin(
        role=new_role,
        is_superuser=new_is_superuser,
        is_active=new_is_active,
    ):
        if _count_active_admin_users(db) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one active admin user must remain.",
            )

    user.email = new_email
    if "full_name" in updates and updates["full_name"] is not None:
        user.full_name = updates["full_name"]
    if "password" in updates and updates["password"] is not None:
        user.hashed_password = get_password_hash(updates["password"])
    user.role = new_role
    user.is_superuser = new_is_superuser
    user.is_active = new_is_active

    db.add(user)
    db.flush()
    create_audit_log(
        db,
        entity_type="user",
        entity_id=str(user.id),
        action=AuditAction.UPDATED,
        old_value=old_value,
        new_value=_serialize_user_for_audit(user),
        user_id=actor_user.id,
    )
    db.commit()
    db.refresh(user)
    return user


def ensure_admin_user(db: Session, settings: Settings) -> User:
    return ensure_bootstrap_user(
        db,
        email=settings.app_admin_email,
        full_name=settings.app_admin_name,
        password=settings.app_admin_password,
        role=UserRole.ADMIN,
        is_active=True,
        is_superuser=True,
    )


def ensure_default_user(db: Session, settings: Settings) -> User | None:
    if not (
        settings.app_default_user_email
        and settings.app_default_user_password
        and settings.app_default_user_name
    ):
        return None

    return ensure_bootstrap_user(
        db,
        email=settings.app_default_user_email,
        full_name=settings.app_default_user_name,
        password=settings.app_default_user_password,
        role=settings.app_default_user_role,
        is_active=True,
        is_superuser=settings.app_default_user_role == UserRole.ADMIN,
    )


def ensure_bootstrap_user(
    db: Session,
    *,
    email: str,
    full_name: str,
    password: str,
    role: UserRole,
    is_active: bool = True,
    is_superuser: bool = False,
) -> User:
    existing_user = get_user_by_email(db, email)
    if existing_user is not None:
        updated = False
        normalized_role, normalized_is_superuser = _resolve_role_and_superuser(
            role=role,
            is_superuser=is_superuser,
        )
        if existing_user.role != normalized_role:
            existing_user.role = normalized_role
            updated = True
        if existing_user.is_superuser != normalized_is_superuser:
            existing_user.is_superuser = normalized_is_superuser
            updated = True
        if existing_user.is_active != is_active:
            existing_user.is_active = is_active
            updated = True
        if existing_user.full_name != full_name:
            existing_user.full_name = full_name
            updated = True
        if not existing_user.hashed_password:
            existing_user.hashed_password = get_password_hash(password)
            updated = True
        if updated:
            db.add(existing_user)
            db.commit()
            db.refresh(existing_user)
        return existing_user

    return create_user(
        db,
        email=email,
        full_name=full_name,
        password=password,
        role=role,
        is_active=is_active,
        is_superuser=is_superuser,
    )
