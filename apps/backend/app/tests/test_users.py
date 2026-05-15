from fastapi.testclient import TestClient

from app.core.enums import UserRole
from app.modules.users.service import ensure_bootstrap_user


def test_admin_can_create_user(client: TestClient, admin_auth_headers: dict[str, str]) -> None:
    portfolio = client.post(
        "/api/v1/portfolios",
        json={
            "name": "User Scope Alpha",
            "description": "Carteira para teste de escopo de usuario.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()

    response = client.post(
        "/api/v1/users",
        json={
            "email": "analyst@flowctrl.local",
            "full_name": "Analyst User",
            "password": "AnalystPass123!",
            "role": "analyst",
            "is_active": True,
            "is_superuser": False,
            "portfolio_ids": [portfolio["id"]],
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "analyst@flowctrl.local"
    assert data["role"] == "analyst"
    assert data["is_active"] is True
    assert data["is_superuser"] is False
    assert [item["id"] for item in data["accessible_portfolios"]] == [portfolio["id"]]


def test_admin_can_update_user_role_and_status(
    client: TestClient,
    admin_auth_headers: dict[str, str],
) -> None:
    portfolio = client.post(
        "/api/v1/portfolios",
        json={
            "name": "User Scope Beta",
            "description": "Carteira para update de usuario.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()

    create_response = client.post(
        "/api/v1/users",
        json={
            "email": "ops@flowctrl.local",
            "full_name": "Ops User",
            "password": "OpsPass123!",
            "role": "viewer",
            "is_active": True,
            "is_superuser": False,
            "portfolio_ids": [],
        },
        headers=admin_auth_headers,
    )
    user_id = create_response.json()["id"]

    response = client.put(
        f"/api/v1/users/{user_id}",
        json={
            "role": "manager",
            "is_active": False,
            "portfolio_ids": [portfolio["id"]],
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "manager"
    assert data["is_active"] is False
    assert [item["id"] for item in data["accessible_portfolios"]] == [portfolio["id"]]


def test_viewer_cannot_access_user_management(
    client: TestClient,
    viewer_auth_headers: dict[str, str],
) -> None:
    response = client.get("/api/v1/users", headers=viewer_auth_headers)

    assert response.status_code == 403


def test_admin_cannot_remove_last_active_admin(
    client: TestClient,
    admin_auth_headers: dict[str, str],
    admin_user,
) -> None:
    response = client.put(
        f"/api/v1/users/{admin_user.id}",
        json={
            "is_active": False,
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "You cannot remove your own administrative access from this screen."
    )


def test_ensure_bootstrap_user_can_seed_non_admin_user(db_session) -> None:
    user = ensure_bootstrap_user(
        db_session,
        email="viewer.seed@flowctrl.local",
        full_name="Viewer Seed",
        password="ViewerSeed123!",
        role=UserRole.VIEWER,
        is_active=True,
        is_superuser=False,
    )

    assert user.email == "viewer.seed@flowctrl.local"
    assert user.role == UserRole.VIEWER
    assert user.is_superuser is False
    assert user.is_active is True
