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


def test_me_update_allows_profile_maintenance(
    client: TestClient,
    viewer_auth_headers: dict[str, str],
) -> None:
    response = client.put(
        "/api/v1/auth/me",
        json={
            "email": "viewer.updated@flowctrl.local",
            "full_name": "Updated Viewer User",
        },
        headers=viewer_auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["email"] == "viewer.updated@flowctrl.local"
    assert payload["full_name"] == "Updated Viewer User"


def test_change_password_updates_login_credentials(
    client: TestClient,
    viewer_auth_headers: dict[str, str],
    viewer_user,
) -> None:
    response = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "ViewerPass123!",
            "new_password": "NewPass456!",
        },
        headers=viewer_auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["detail"] == "Password updated successfully."

    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": viewer_user.email, "password": "ViewerPass123!"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": viewer_user.email, "password": "NewPass456!"},
    )
    assert new_login.status_code == 200


def test_change_password_requires_valid_current_password(
    client: TestClient,
    viewer_auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "WrongPass123!",
            "new_password": "NewPass456!",
        },
        headers=viewer_auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect."


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
