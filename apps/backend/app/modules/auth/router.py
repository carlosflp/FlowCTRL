from fastapi import APIRouter

from app.modules.auth.schemas import AuthStatusResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/status", response_model=AuthStatusResponse)
def auth_status() -> AuthStatusResponse:
    return AuthStatusResponse(
        enabled=False,
        message="Authentication scaffolding is in place; login flow will be implemented later.",
    )

