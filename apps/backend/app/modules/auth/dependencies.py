from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.enums import UserRole
from app.core.security import decode_access_token
from app.db.session import get_db
from app.modules.users.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(str(payload["sub"]))
    except (InvalidTokenError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        ) from None

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user was not found.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user.",
        )
    return user


def require_roles(*allowed_roles: UserRole):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.is_superuser:
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return dependency


CurrentUser = Annotated[User, Depends(get_current_user)]
ReadAccessUser = Annotated[
    User,
    Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ANALYST, UserRole.VIEWER)),
]
WriteAccessUser = Annotated[
    User,
    Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ANALYST)),
]
DeleteAccessUser = Annotated[
    User,
    Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
]
ManageAccessUser = Annotated[
    User,
    Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
]
AdminAccessUser = Annotated[
    User,
    Depends(require_roles(UserRole.ADMIN)),
]
