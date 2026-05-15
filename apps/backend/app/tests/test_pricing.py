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


def test_list_asset_prices_can_filter_by_portfolio(
    client: TestClient,
    admin_auth_headers: dict[str, str],
) -> None:
    alpha_portfolio = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Pricing Alpha",
            "description": "Carteira alpha para precos.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    beta_portfolio = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Pricing Beta",
            "description": "Carteira beta para precos.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    alpha_asset = client.post(
        "/api/v1/assets",
        json={
            "ticker": "PRICE-ALPHA",
            "name": "Price Alpha Asset",
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "IPCA",
            "maturity_date": "2034-08-15",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    beta_asset = client.post(
        "/api/v1/assets",
        json={
            "ticker": "PRICE-BETA",
            "name": "Price Beta Asset",
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "IPCA",
            "maturity_date": "2034-08-15",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()

    for portfolio_id, asset_id, ticker in (
        (alpha_portfolio["id"], alpha_asset["id"], "PRICE-ALPHA"),
        (beta_portfolio["id"], beta_asset["id"], "PRICE-BETA"),
    ):
        operation_response = client.post(
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
                "notes": f"pricing {ticker}",
            },
            headers=admin_auth_headers,
        )
        assert operation_response.status_code == 201

        price_response = client.post(
            "/api/v1/pricing",
            json={
                "asset_id": asset_id,
                "price_date": "2026-05-13",
                "price": "101.25",
                "source": "manual",
                "is_validated": True,
            },
            headers=admin_auth_headers,
        )
        assert price_response.status_code == 201

    response = client.get(
        f"/api/v1/pricing?portfolio_id={alpha_portfolio['id']}",
        headers=admin_auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert [item["asset"]["ticker"] for item in payload] == ["PRICE-ALPHA"]
