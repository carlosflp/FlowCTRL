from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.core.enums import UserRole


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    project_name: str = "Asset Platform"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"

    database_url: str = Field(
        default="postgresql+psycopg://asset:asset@postgres:5432/asset_platform",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")
    jwt_secret_key: str = Field(
        default="change-me-in-local-env-with-at-least-32-bytes",
        alias="JWT_SECRET_KEY",
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    app_admin_email: str = Field(default="admin@flowctrl.local", alias="APP_ADMIN_EMAIL")
    app_admin_password: str = Field(default="ChangeMe123!", alias="APP_ADMIN_PASSWORD")
    app_admin_name: str = Field(default="Platform Admin", alias="APP_ADMIN_NAME")
    app_default_user_email: str | None = Field(default=None, alias="APP_DEFAULT_USER_EMAIL")
    app_default_user_password: str | None = Field(default=None, alias="APP_DEFAULT_USER_PASSWORD")
    app_default_user_name: str | None = Field(default=None, alias="APP_DEFAULT_USER_NAME")
    app_default_user_role: UserRole = Field(default=UserRole.VIEWER, alias="APP_DEFAULT_USER_ROLE")

    minio_endpoint: str = Field(default="minio:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(default="minioadmin", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="minioadmin", alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(default="asset-platform-reports", alias="MINIO_BUCKET")
    minio_imports_bucket: str = Field(default="asset-platform-imports", alias="MINIO_IMPORTS_BUCKET")

    backend_cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        alias="BACKEND_CORS_ORIGINS",
    )

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [origin.strip() for origin in value.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
