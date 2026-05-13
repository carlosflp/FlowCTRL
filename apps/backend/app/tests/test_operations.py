from fastapi.testclient import TestClient


def test_create_operation(client: TestClient, admin_auth_headers: dict[str, str]) -> None:
    portfolio_response = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Crédito Privado",
            "description": "Estratégia core.",
            "base_currency": "BRL",
            "benchmark": "IMA-B",
            "is_active": True,
        },
        headers=admin_auth_headers,
    )
    asset_response = client.post(
        "/api/v1/assets",
        json={
            "ticker": "DEB-ALFA-01",
            "name": "Debênture Alfa",
            "asset_type": "debenture",
            "issuer": "Alfa Infra",
            "indexer": "CDI",
            "maturity_date": "2030-01-10",
            "is_active": True,
        },
        headers=admin_auth_headers,
    )

    operation_payload = {
        "portfolio_id": portfolio_response.json()["id"],
        "asset_id": asset_response.json()["id"],
        "operation_type": "buy",
        "trade_date": "2026-05-10",
        "settlement_date": "2026-05-12",
        "quantity": "1000",
        "unit_price": "98.75",
        "fees": "10.50",
        "taxes": "0",
        "status": "approved",
        "notes": "Compra inicial da posição.",
    }

    response = client.post("/api/v1/operations", json=operation_payload, headers=admin_auth_headers)

    assert response.status_code == 201
    data = response.json()
    assert data["operation_type"] == "buy"
    assert data["status"] == "approved"
    assert data["portfolio"]["name"] == "Crédito Privado"
    assert data["asset"]["ticker"] == "DEB-ALFA-01"
