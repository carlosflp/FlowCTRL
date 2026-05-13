import uuid

from fastapi.testclient import TestClient

from app.modules.reports.service import process_report_execution_in_session


def test_create_report_template(client: TestClient, admin_auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/v1/reports/templates",
        json={
            "name": "Operacoes Custom CSV",
            "description": "Template customizado para operacoes.",
            "template_type": "csv",
            "config_json": {"dataset": "operations"},
            "is_active": True,
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Operacoes Custom CSV"
    assert data["config_json"]["dataset"] == "operations"


def test_create_report_execution_queues_task(
    client: TestClient,
    admin_auth_headers: dict[str, str],
    monkeypatch,
) -> None:
    template = client.post(
        "/api/v1/reports/templates",
        json={
            "name": "Fila Teste CSV",
            "description": "Template para teste de fila.",
            "template_type": "csv",
            "config_json": {"dataset": "operations"},
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()

    queued_execution_ids: list[str] = []

    def fake_queue_report_execution(execution_id) -> None:
        queued_execution_ids.append(str(execution_id))

    monkeypatch.setattr(
        "app.modules.reports.service.queue_report_execution",
        fake_queue_report_execution,
    )

    response = client.post(
        "/api/v1/reports/executions",
        json={"template_id": template["id"], "portfolio_id": None, "parameters_json": None},
        headers=admin_auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "queued"
    assert queued_execution_ids == [data["id"]]


def test_process_report_execution_marks_execution_as_completed(
    client: TestClient,
    admin_auth_headers: dict[str, str],
    db_session,
    monkeypatch,
) -> None:
    portfolio = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Relatorio Fundo",
            "description": "Carteira para teste de relatorio.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    asset = client.post(
        "/api/v1/assets",
        json={
            "ticker": "REL-TEST",
            "name": "Ativo Relatorio",
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "CDI",
            "maturity_date": "2035-01-01",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    client.post(
        "/api/v1/operations",
        json={
            "portfolio_id": portfolio["id"],
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
    )
    template = client.post(
        "/api/v1/reports/templates",
        json={
            "name": "Processamento CSV",
            "description": "Template para teste de processamento.",
            "template_type": "csv",
            "config_json": {"dataset": "operations"},
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()

    monkeypatch.setattr(
        "app.modules.reports.service.queue_report_execution",
        lambda execution_id: None,
    )
    monkeypatch.setattr(
        "app.modules.reports.service.upload_report_content",
        lambda **kwargs: "reports/test-report.csv",
    )

    execution = client.post(
        "/api/v1/reports/executions",
        json={
            "template_id": template["id"],
            "portfolio_id": portfolio["id"],
            "parameters_json": None,
        },
        headers=admin_auth_headers,
    ).json()

    process_report_execution_in_session(db_session, uuid.UUID(execution["id"]))
    db_session.expire_all()

    refreshed = client.get(
        f"/api/v1/reports/executions/{execution['id']}",
        headers=admin_auth_headers,
    ).json()

    assert refreshed["status"] == "completed"
    assert refreshed["file_path"].startswith("reports/")
    assert refreshed["file_path"].endswith(".csv")
    assert refreshed["file_type"] == "csv"
