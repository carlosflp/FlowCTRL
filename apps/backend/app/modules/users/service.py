from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.enums import UserRole
from app.core.security import get_password_hash
from app.modules.users.models import User


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    statement = select(User).where(User.email == normalize_email(email))
    return db.scalar(statement)


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


def ensure_admin_user(db: Session, settings: Settings) -> User:
    existing_user = get_user_by_email(db, settings.app_admin_email)
    if existing_user is not None:
        updated = False
        if existing_user.role != UserRole.ADMIN:
            existing_user.role = UserRole.ADMIN
            updated = True
        if not existing_user.is_superuser:
            existing_user.is_superuser = True
            updated = True
        if not existing_user.is_active:
            existing_user.is_active = True
            updated = True
        if existing_user.full_name != settings.app_admin_name:
            existing_user.full_name = settings.app_admin_name
            updated = True
        if not existing_user.hashed_password:
            existing_user.hashed_password = get_password_hash(settings.app_admin_password)
            updated = True
        if updated:
            db.add(existing_user)
            db.commit()
            db.refresh(existing_user)
        return existing_user

    return create_user(
        db,
        email=settings.app_admin_email,
        full_name=settings.app_admin_name,
        password=settings.app_admin_password,
        role=UserRole.ADMIN,
        is_active=True,
        is_superuser=True,
    )
