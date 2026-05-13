from fastapi.testclient import TestClient


def test_create_cashflow_entry(client: TestClient, admin_auth_headers: dict[str, str]) -> None:
    portfolio_response = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Treasury",
            "description": "Treasury book.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    )

    response = client.post(
        "/api/v1/cashflow",
        json={
            "portfolio_id": portfolio_response.json()["id"],
            "entry_date": "2026-05-13",
            "settlement_date": "2026-05-14",
            "description": "Capital contribution",
            "entry_type": "inflow",
            "amount": "1500000.00",
            "status": "pending",
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["entry_type"] == "inflow"
    assert data["portfolio"]["name"] == "Treasury"


def test_cashflow_entry_rejects_operation_from_other_portfolio(
    client: TestClient,
    admin_auth_headers: dict[str, str],
) -> None:
    portfolio_a = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Portfolio A",
            "description": "A",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    portfolio_b = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Portfolio B",
            "description": "B",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    asset = client.post(
        "/api/v1/assets",
        json={
            "ticker": "CASHFLOW-TEST",
            "name": "Cashflow Test Asset",
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "CDI",
            "maturity_date": "2030-01-01",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    operation = client.post(
        "/api/v1/operations",
        json={
            "portfolio_id": portfolio_a["id"],
            "asset_id": asset["id"],
            "operation_type": "buy",
            "trade_date": "2026-05-13",
            "settlement_date": "2026-05-14",
            "quantity": "10",
            "unit_price": "100",
            "fees": "0",
            "taxes": "0",
            "status": "approved",
        },
        headers=admin_auth_headers,
    ).json()

    response = client.post(
        "/api/v1/cashflow",
        json={
            "portfolio_id": portfolio_b["id"],
            "operation_id": operation["id"],
            "entry_date": "2026-05-13",
            "settlement_date": "2026-05-14",
            "description": "Invalid reconciliation",
            "entry_type": "outflow",
            "amount": "1000.00",
            "status": "pending",
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 422
