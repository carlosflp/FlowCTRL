from fastapi.testclient import TestClient


def _create_portfolio(client: TestClient, headers: dict[str, str], name: str) -> dict:
    response = client.post(
        "/api/v1/portfolios",
        json={
            "name": name,
            "description": f"{name} strategy",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def _create_asset(client: TestClient, headers: dict[str, str], ticker: str, name: str) -> dict:
    response = client.post(
        "/api/v1/assets",
        json={
            "ticker": ticker,
            "name": name,
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "CDI",
            "maturity_date": "2030-01-01",
            "is_active": True,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def _create_operation(
    client: TestClient,
    headers: dict[str, str],
    *,
    portfolio_id: str,
    asset_id: str,
    operation_type: str,
    trade_date: str,
    quantity: str,
    unit_price: str,
    status: str,
) -> dict:
    response = client.post(
        "/api/v1/operations",
        json={
            "portfolio_id": portfolio_id,
            "asset_id": asset_id,
            "operation_type": operation_type,
            "trade_date": trade_date,
            "settlement_date": trade_date,
            "quantity": quantity,
            "unit_price": unit_price,
            "fees": "0",
            "taxes": "0",
            "status": status,
            "notes": "position test",
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def _create_price(
    client: TestClient,
    headers: dict[str, str],
    *,
    asset_id: str,
    price_date: str,
    price: str,
    source: str,
    is_validated: bool,
) -> dict:
    response = client.post(
        "/api/v1/pricing",
        json={
            "asset_id": asset_id,
            "price_date": price_date,
            "price": price,
            "source": source,
            "is_validated": is_validated,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_list_positions_returns_consolidated_rows(
    client: TestClient,
    admin_auth_headers: dict[str, str],
) -> None:
    alpha_portfolio = _create_portfolio(client, admin_auth_headers, "Alpha Credit")
    beta_portfolio = _create_portfolio(client, admin_auth_headers, "Beta Macro")
    bond_asset = _create_asset(client, admin_auth_headers, "BOND-ALPHA-01", "Alpha Bond")
    note_asset = _create_asset(client, admin_auth_headers, "NOTE-BETA-01", "Beta Note")

    _create_operation(
        client,
        admin_auth_headers,
        portfolio_id=alpha_portfolio["id"],
        asset_id=bond_asset["id"],
        operation_type="buy",
        trade_date="2026-05-01",
        quantity="100",
        unit_price="10",
        status="approved",
    )
    _create_operation(
        client,
        admin_auth_headers,
        portfolio_id=alpha_portfolio["id"],
        asset_id=bond_asset["id"],
        operation_type="buy",
        trade_date="2026-05-03",
        quantity="50",
        unit_price="12",
        status="settled",
    )
    _create_operation(
        client,
        admin_auth_headers,
        portfolio_id=alpha_portfolio["id"],
        asset_id=bond_asset["id"],
        operation_type="sell",
        trade_date="2026-05-05",
        quantity="40",
        unit_price="11",
        status="approved",
    )
    _create_operation(
        client,
        admin_auth_headers,
        portfolio_id=alpha_portfolio["id"],
        asset_id=bond_asset["id"],
        operation_type="dividend",
        trade_date="2026-05-06",
        quantity="1",
        unit_price="5",
        status="approved",
    )
    _create_operation(
        client,
        admin_auth_headers,
        portfolio_id=beta_portfolio["id"],
        asset_id=note_asset["id"],
        operation_type="buy",
        trade_date="2026-05-02",
        quantity="200",
        unit_price="7.5",
        status="approved",
    )
    _create_operation(
        client,
        admin_auth_headers,
        portfolio_id=beta_portfolio["id"],
        asset_id=note_asset["id"],
        operation_type="buy",
        trade_date="2026-05-08",
        quantity="10",
        unit_price="8",
        status="draft",
    )

    _create_price(
        client,
        admin_auth_headers,
        asset_id=bond_asset["id"],
        price_date="2026-05-05",
        price="11.8",
        source="manual",
        is_validated=True,
    )
    _create_price(
        client,
        admin_auth_headers,
        asset_id=bond_asset["id"],
        price_date="2026-05-05",
        price="11.7",
        source="vendor",
        is_validated=False,
    )

    response = client.get(
        "/api/v1/positions?as_of_date=2026-05-07",
        headers=admin_auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    alpha_position = next(item for item in data if item["portfolio"]["id"] == alpha_portfolio["id"])
    beta_position = next(item for item in data if item["portfolio"]["id"] == beta_portfolio["id"])

    assert alpha_position["asset"]["ticker"] == "BOND-ALPHA-01"
    assert alpha_position["quantity"] == "110.00000000"
    assert alpha_position["average_cost"] == "10.66666667"
    assert alpha_position["total_cost_basis"] == "1173.3333"
    assert alpha_position["latest_price"] == "11.8000"
    assert alpha_position["market_value"] == "1298.0000"
    assert alpha_position["unrealized_pnl"] == "124.6667"
    assert alpha_position["operation_count"] == 3
    assert alpha_position["is_price_validated"] is True

    assert beta_position["asset"]["ticker"] == "NOTE-BETA-01"
    assert beta_position["quantity"] == "200.00000000"
    assert beta_position["latest_price"] is None
    assert beta_position["market_value"] is None
    assert beta_position["operation_count"] == 1


def test_position_overview_filters_by_portfolio(
    client: TestClient,
    admin_auth_headers: dict[str, str],
) -> None:
    alpha_portfolio = _create_portfolio(client, admin_auth_headers, "Alpha Filtered")
    beta_portfolio = _create_portfolio(client, admin_auth_headers, "Beta Filtered")
    alpha_asset = _create_asset(client, admin_auth_headers, "ALPHA-FLT-01", "Alpha Filtered Asset")
    beta_asset = _create_asset(client, admin_auth_headers, "BETA-FLT-01", "Beta Filtered Asset")

    _create_operation(
        client,
        admin_auth_headers,
        portfolio_id=alpha_portfolio["id"],
        asset_id=alpha_asset["id"],
        operation_type="buy",
        trade_date="2026-05-01",
        quantity="10",
        unit_price="100",
        status="approved",
    )
    _create_operation(
        client,
        admin_auth_headers,
        portfolio_id=beta_portfolio["id"],
        asset_id=beta_asset["id"],
        operation_type="buy",
        trade_date="2026-05-02",
        quantity="20",
        unit_price="50",
        status="approved",
    )

    _create_price(
        client,
        admin_auth_headers,
        asset_id=alpha_asset["id"],
        price_date="2026-05-02",
        price="102",
        source="manual",
        is_validated=True,
    )

    response = client.get(
        f"/api/v1/positions/overview?portfolio_id={alpha_portfolio['id']}&as_of_date=2026-05-03",
        headers=admin_auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["open_positions"] == 1
    assert data["priced_positions"] == 1
    assert data["unpriced_positions"] == 0
    assert data["total_cost_basis"] == "1000.0000"
    assert data["total_market_value"] == "1020.0000"
    assert data["total_unrealized_pnl"] == "20.0000"
    assert data["pricing_coverage_pct"] == "1.00000000"


def test_positions_endpoint_is_accessible_to_viewer(
    client: TestClient,
    admin_auth_headers: dict[str, str],
    viewer_auth_headers: dict[str, str],
) -> None:
    portfolio = _create_portfolio(client, admin_auth_headers, "Viewer Scope")
    asset = _create_asset(client, admin_auth_headers, "VIEW-01", "Viewer Asset")

    _create_operation(
        client,
        admin_auth_headers,
        portfolio_id=portfolio["id"],
        asset_id=asset["id"],
        operation_type="buy",
        trade_date="2026-05-01",
        quantity="10",
        unit_price="10",
        status="approved",
    )

    response = client.get("/api/v1/positions", headers=viewer_auth_headers)

    assert response.status_code == 200
    assert len(response.json()) == 1
