from fastapi.testclient import TestClient


def test_create_portfolio(client: TestClient) -> None:
    payload = {
        "name": "Fundo Macro",
        "description": "Carteira principal de macro strategies.",
        "base_currency": "BRL",
        "benchmark": "CDI",
        "is_active": True,
    }

    response = client.post("/api/v1/portfolios", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == payload["name"]
    assert data["benchmark"] == "CDI"

