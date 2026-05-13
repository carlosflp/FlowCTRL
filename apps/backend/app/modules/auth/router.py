from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import UserRole
from app.db.session import get_db
from app.modules.auth.dependencies import CurrentUser
from app.modules.auth.schemas import AccessTokenResponse, AuthStatusResponse, LoginRequest
from app.modules.auth.service import authenticate_user, build_login_response
from app.modules.users.schemas import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.get("/status", response_model=AuthStatusResponse)
def auth_status() -> AuthStatusResponse:
    return AuthStatusResponse(
        enabled=True,
        token_type="bearer",
        default_admin_email=settings.app_admin_email,
        available_roles=[role for role in UserRole],
    )


@router.post("/login", response_model=AccessTokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AccessTokenResponse:
    user = authenticate_user(db, email=payload.email, password=payload.password)
    return build_login_response(user)


@router.get("/me", response_model=UserRead)
def read_authenticated_user(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)
