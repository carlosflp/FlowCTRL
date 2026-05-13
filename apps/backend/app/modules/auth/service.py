from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, verify_password
from app.modules.auth.schemas import AccessTokenResponse
from app.modules.users.models import User
from app.modules.users.service import get_user_by_email
from app.modules.users.schemas import UserRead


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


def build_login_response(user: User) -> AccessTokenResponse:
    settings = get_settings()
    token = create_access_token(subject=str(user.id), email=user.email, role=user.role.value)
    return AccessTokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserRead.model_validate(user),
    )
