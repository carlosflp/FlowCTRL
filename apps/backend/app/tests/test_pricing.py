from fastapi.testclient import TestClient


def test_create_asset_price(client: TestClient, admin_auth_headers: dict[str, str]) -> None:
    asset_response = client.post(
        "/api/v1/assets",
        json={
            "ticker": "PRICE-TEST",
            "name": "Pricing Test Asset",
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "IPCA",
            "maturity_date": "2034-08-15",
            "is_active": True,
        },
        headers=admin_auth_headers,
    )

    response = client.post(
        "/api/v1/pricing",
        json={
            "asset_id": asset_response.json()["id"],
            "price_date": "2026-05-13",
            "price": "101.25",
            "source": "manual",
            "is_validated": True,
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["asset"]["ticker"] == "PRICE-TEST"
    assert data["source"] == "manual"


def test_asset_price_rejects_duplicate_asset_date_source(
    client: TestClient,
    admin_auth_headers: dict[str, str],
) -> None:
    asset = client.post(
        "/api/v1/assets",
        json={
            "ticker": "DUP-PRICE",
            "name": "Duplicate Pricing Asset",
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "IPCA",
            "maturity_date": "2034-08-15",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()

    payload = {
        "asset_id": asset["id"],
        "price_date": "2026-05-13",
        "price": "98.10",
        "source": "manual",
        "is_validated": False,
    }

    first_response = client.post("/api/v1/pricing", json=payload, headers=admin_auth_headers)
    duplicate_response = client.post("/api/v1/pricing", json=payload, headers=admin_auth_headers)

    assert first_response.status_code == 201
    assert duplicate_response.status_code == 409
