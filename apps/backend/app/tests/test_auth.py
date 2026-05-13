from fastapi.testclient import TestClient


def test_login_returns_access_token(client: TestClient, admin_user) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": admin_user.email, "password": "ChangeMe123!"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["user"]["role"] == "admin"


def test_me_returns_authenticated_user(client: TestClient, admin_auth_headers: dict[str, str]) -> None:
    response = client.get("/api/v1/auth/me", headers=admin_auth_headers)

    assert response.status_code == 200
    assert response.json()["email"] == "admin@flowctrl.local"


def test_protected_route_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/portfolios")

    assert response.status_code == 401


def test_viewer_cannot_create_portfolio(client: TestClient, viewer_auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Viewer Attempt",
            "description": "Should not be created.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=viewer_auth_headers,
    )

    assert response.status_code == 403
