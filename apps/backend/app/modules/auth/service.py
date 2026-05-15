from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, verify_password
from app.modules.auth.schemas import AccessTokenResponse
from app.modules.users.models import User
from app.modules.users.schemas import UserRead, UserUpdate
from app.modules.users.service import build_user_read, get_user_by_email, update_user


def authenticate_user(db: Session, *, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user.",
        )
    return user


def build_login_response(db: Session, user: User) -> AccessTokenResponse:
    settings = get_settings()
    token = create_access_token(subject=str(user.id), email=user.email, role=user.role.value)
    return AccessTokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        user=build_user_read(db, user),
    )


def update_authenticated_user_profile(
    db: Session,
    *,
    user: User,
    email: str,
    full_name: str,
) -> User:
    return update_user(
        db,
        user=user,
        payload=UserUpdate(email=email, full_name=full_name),
        actor_user=user,
        enforce_self_admin_protection=False,
    )


def change_authenticated_user_password(
    db: Session,
    *,
    user: User,
    current_password: str,
    new_password: str,
) -> User:
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if current_password == new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    return update_user(
        db,
        user=user,
        payload=UserUpdate(password=new_password),
        actor_user=user,
        enforce_self_admin_protection=False,
    )
