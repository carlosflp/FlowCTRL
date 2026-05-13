from fastapi.testclient import TestClient


def test_create_asset(client: TestClient, admin_auth_headers: dict[str, str]) -> None:
    payload = {
        "ticker": "NTNB2035",
        "name": "Tesouro IPCA 2035",
        "asset_type": "bond",
        "issuer": "Tesouro Nacional",
        "indexer": "IPCA",
        "maturity_date": "2035-05-15",
        "is_active": True,
    }

    response = client.post("/api/v1/assets", json=payload, headers=admin_auth_headers)

    assert response.status_code == 201
    data = response.json()
    assert data["ticker"] == payload["ticker"]
    assert data["asset_type"] == "bond"
