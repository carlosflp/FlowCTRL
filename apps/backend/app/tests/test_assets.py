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


def test_list_assets_can_filter_by_portfolio(client: TestClient, admin_auth_headers: dict[str, str]) -> None:
    alpha_portfolio = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Assets Alpha",
            "description": "Carteira alpha para ativos.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    beta_portfolio = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Assets Beta",
            "description": "Carteira beta para ativos.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    alpha_asset = client.post(
        "/api/v1/assets",
        json={
            "ticker": "ASSET-ALPHA",
            "name": "Asset Alpha",
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "CDI",
            "maturity_date": "2035-01-01",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    beta_asset = client.post(
        "/api/v1/assets",
        json={
            "ticker": "ASSET-BETA",
            "name": "Asset Beta",
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "CDI",
            "maturity_date": "2035-01-01",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()

    for portfolio_id, asset_id in (
        (alpha_portfolio["id"], alpha_asset["id"]),
        (beta_portfolio["id"], beta_asset["id"]),
    ):
        response = client.post(
            "/api/v1/operations",
            json={
                "portfolio_id": portfolio_id,
                "asset_id": asset_id,
                "operation_type": "buy",
                "trade_date": "2026-05-13",
                "settlement_date": "2026-05-13",
                "quantity": "10",
                "unit_price": "100",
                "fees": "0",
                "taxes": "0",
                "status": "approved",
            },
            headers=admin_auth_headers,
        )
        assert response.status_code == 201

    response = client.get(
        f"/api/v1/assets?portfolio_id={alpha_portfolio['id']}",
        headers=admin_auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert [item["ticker"] for item in payload] == ["ASSET-ALPHA"]
