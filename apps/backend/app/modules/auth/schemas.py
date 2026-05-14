from pydantic import BaseModel, Field

from app.core.enums import UserRole
from app.modules.users.schemas import UserRead


class AuthStatusResponse(BaseModel):
    enabled: bool
    token_type: str
    default_admin_email: str
    available_roles: list[UserRole]


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)


class AuthProfileUpdateRequest(BaseModel):
    email: str
    full_name: str = Field(min_length=3)


class AuthPasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=8)
    new_password: str = Field(min_length=8)


class AuthActionResponse(BaseModel):
    detail: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserRead
