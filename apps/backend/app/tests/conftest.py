from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.enums import UserRole
from app.db.base import Base
from app.db import models  # noqa: F401
from app.db.session import get_db
from app.main import app
from app.modules.users.models import User
from app.modules.users.service import create_user

SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture(autouse=True)
def reset_database() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db_session: Session) -> User:
    return create_user(
        db_session,
        email="admin@flowctrl.local",
        full_name="Platform Admin",
        password="ChangeMe123!",
        role=UserRole.ADMIN,
        is_active=True,
        is_superuser=True,
    )


@pytest.fixture
def viewer_user(db_session: Session) -> User:
    return create_user(
        db_session,
        email="viewer@flowctrl.local",
        full_name="Viewer User",
        password="ViewerPass123!",
        role=UserRole.VIEWER,
        is_active=True,
        is_superuser=False,
    )


@pytest.fixture
def admin_auth_headers(client: TestClient, admin_user: User) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": admin_user.email, "password": "ChangeMe123!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def viewer_auth_headers(client: TestClient, viewer_user: User) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": viewer_user.email, "password": "ViewerPass123!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
