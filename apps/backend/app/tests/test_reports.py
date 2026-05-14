import uuid
from io import StringIO

import pandas as pd

from fastapi.testclient import TestClient

from app.modules.reports.service import process_report_execution_in_session


def create_report_template(
    client: TestClient,
    admin_auth_headers: dict[str, str],
    *,
    name: str,
    dataset: str,
    template_type: str = "xlsx",
    description: str = "Template de teste.",
    config_json: dict[str, object] | None = None,
    is_active: bool = True,
) -> dict[str, object]:
    return client.post(
        "/api/v1/reports/templates",
        json={
            "name": name,
            "description": description,
            "template_type": template_type,
            "config_json": config_json or {"dataset": dataset},
            "is_active": is_active,
        },
        headers=admin_auth_headers,
    ).json()


def test_create_report_template(client: TestClient, admin_auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/v1/reports/templates",
        json={
            "name": "Operacoes Custom",
            "description": "Template customizado para operacoes.",
            "config_json": {"dataset": "operations"},
            "is_active": True,
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Operacoes Custom"
    assert data["config_json"]["dataset"] == "operations"
    assert data["template_type"] == "xlsx"


def test_create_report_execution_queues_task(
    client: TestClient,
    admin_auth_headers: dict[str, str],
    monkeypatch,
) -> None:
    template = create_report_template(
        client,
        admin_auth_headers,
        name="Fila Teste",
        dataset="operations",
    )

    queued_execution_ids: list[str] = []

    def fake_queue_report_execution(execution_id) -> None:
        queued_execution_ids.append(str(execution_id))

    monkeypatch.setattr(
        "app.modules.reports.service.queue_report_execution",
        fake_queue_report_execution,
    )

    response = client.post(
        "/api/v1/reports/executions",
        json={"template_id": template["id"], "portfolio_id": None, "file_type": "pdf", "parameters_json": None},
        headers=admin_auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "queued"
    assert data["file_type"] == "pdf"
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
    template = create_report_template(
        client,
        admin_auth_headers,
        name="Processamento Base",
        dataset="operations",
        template_type="xlsx",
        description="Template para teste de processamento.",
    )

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
            "file_type": "csv",
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


def test_create_report_execution_rejects_unsupported_portfolio_scope(
    client: TestClient,
    admin_auth_headers: dict[str, str],
) -> None:
    portfolio = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Escopo Invalido Fundo",
            "description": "Carteira para validar escopo invalido.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    template = create_report_template(
        client,
        admin_auth_headers,
        name="Precos Restritos",
        dataset="pricing",
        template_type="csv",
        description="Template de precos sem filtro por carteira.",
    )

    response = client.post(
        "/api/v1/reports/executions",
        json={
            "template_id": template["id"],
            "portfolio_id": portfolio["id"],
            "parameters_json": None,
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Portfolio scope is not supported for the pricing dataset."


def test_create_report_execution_rejects_invalid_columns(
    client: TestClient,
    admin_auth_headers: dict[str, str],
) -> None:
    template = create_report_template(
        client,
        admin_auth_headers,
        name="Operacoes Invalidas",
        dataset="operations",
        template_type="csv",
        description="Template para validar colunas invalidas.",
    )

    response = client.post(
        "/api/v1/reports/executions",
        json={
            "template_id": template["id"],
            "portfolio_id": None,
            "parameters_json": {
                "columns": ["trade_date", "unknown_column"],
            },
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 422
    assert "Invalid report columns for the operations dataset" in response.json()["detail"]


def test_process_report_execution_applies_date_range_and_custom_columns(
    client: TestClient,
    admin_auth_headers: dict[str, str],
    db_session,
    monkeypatch,
) -> None:
    portfolio = client.post(
        "/api/v1/portfolios",
        json={
            "name": "Filtro Fundo",
            "description": "Carteira para teste de filtro de relatorio.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    asset = client.post(
        "/api/v1/assets",
        json={
            "ticker": "FILTRO-1",
            "name": "Ativo Filtro",
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
            "trade_date": "2026-05-10",
            "settlement_date": "2026-05-10",
            "quantity": "10",
            "unit_price": "100",
            "fees": "0",
            "taxes": "0",
            "status": "approved",
            "notes": "inside range",
        },
        headers=admin_auth_headers,
    )
    client.post(
        "/api/v1/operations",
        json={
            "portfolio_id": portfolio["id"],
            "asset_id": asset["id"],
            "operation_type": "buy",
            "trade_date": "2026-05-12",
            "settlement_date": "2026-05-12",
            "quantity": "20",
            "unit_price": "120",
            "fees": "0",
            "taxes": "0",
            "status": "approved",
            "notes": "outside range",
        },
        headers=admin_auth_headers,
    )
    template = create_report_template(
        client,
        admin_auth_headers,
        name="Operacoes Filtradas",
        dataset="operations",
        template_type="xlsx",
        description="Template para filtro por periodo e colunas.",
    )

    uploaded_payloads: list[dict[str, object]] = []

    monkeypatch.setattr(
        "app.modules.reports.service.queue_report_execution",
        lambda execution_id: None,
    )

    def fake_upload_report_content(**kwargs) -> str:
        uploaded_payloads.append(kwargs)
        return "reports/filtered-report.csv"

    monkeypatch.setattr(
        "app.modules.reports.service.upload_report_content",
        fake_upload_report_content,
    )

    execution = client.post(
        "/api/v1/reports/executions",
        json={
            "template_id": template["id"],
            "portfolio_id": portfolio["id"],
            "file_type": "csv",
            "parameters_json": {
                "date_from": "2026-05-10",
                "date_to": "2026-05-10",
                "columns": ["trade_date", "portfolio", "asset", "status"],
            },
        },
        headers=admin_auth_headers,
    ).json()

    process_report_execution_in_session(db_session, uuid.UUID(execution["id"]))

    assert len(uploaded_payloads) == 1
    csv_text = uploaded_payloads[0]["content"].decode("utf-8")
    dataframe = pd.read_csv(StringIO(csv_text))

    assert list(dataframe.columns) == ["trade_date", "portfolio", "asset", "status"]
    assert len(dataframe.index) == 1
    assert dataframe.iloc[0]["trade_date"] == "2026-05-10"
    assert dataframe.iloc[0]["portfolio"] == "Filtro Fundo"
    assert dataframe.iloc[0]["asset"] == "FILTRO-1"
    assert dataframe.iloc[0]["status"] == "approved"


def test_custom_report_template_accepts_dataset_override_and_export_selection(
    client: TestClient,
    admin_auth_headers: dict[str, str],
    db_session,
    monkeypatch,
) -> None:
    asset = client.post(
        "/api/v1/assets",
        json={
            "ticker": "CUSTOM-PRC",
            "name": "Ativo Customizado",
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "CDI",
            "maturity_date": "2035-01-01",
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()
    client.post(
        "/api/v1/pricing",
        json={
            "asset_id": asset["id"],
            "price_date": "2026-05-11",
            "price": "101.45",
            "source": "anbima",
            "is_validated": True,
        },
        headers=admin_auth_headers,
    )
    template = create_report_template(
        client,
        admin_auth_headers,
        name="Template Customizavel",
        dataset="operations",
        template_type="xlsx",
        description="Template especial para relatorio personalizado.",
        config_json={
            "dataset": "operations",
            "custom_template": True,
            "allow_custom_dataset": True,
        },
    )

    uploaded_payloads: list[dict[str, object]] = []

    monkeypatch.setattr(
        "app.modules.reports.service.queue_report_execution",
        lambda execution_id: None,
    )

    def fake_upload_report_content(**kwargs) -> str:
        uploaded_payloads.append(kwargs)
        return "reports/custom-report.csv"

    monkeypatch.setattr(
        "app.modules.reports.service.upload_report_content",
        fake_upload_report_content,
    )

    execution = client.post(
        "/api/v1/reports/executions",
        json={
            "template_id": template["id"],
            "portfolio_id": None,
            "file_type": "csv",
            "parameters_json": {
                "dataset": "pricing",
                "date_from": "2026-05-11",
                "date_to": "2026-05-11",
                "columns": ["price_date", "asset", "price", "source"],
            },
        },
        headers=admin_auth_headers,
    ).json()

    process_report_execution_in_session(db_session, uuid.UUID(execution["id"]))
    csv_text = uploaded_payloads[0]["content"].decode("utf-8")
    dataframe = pd.read_csv(StringIO(csv_text))

    assert list(dataframe.columns) == ["price_date", "asset", "price", "source"]
    assert len(dataframe.index) == 1
    assert dataframe.iloc[0]["asset"] == "CUSTOM-PRC"
    assert execution["parameters_json"]["dataset"] == "pricing"
    assert execution["file_type"] == "csv"


def test_regular_report_template_rejects_dataset_override(
    client: TestClient,
    admin_auth_headers: dict[str, str],
) -> None:
    template = create_report_template(
        client,
        admin_auth_headers,
        name="Template Fixo",
        dataset="operations",
        template_type="xlsx",
    )

    response = client.post(
        "/api/v1/reports/executions",
        json={
            "template_id": template["id"],
            "portfolio_id": None,
            "file_type": "csv",
            "parameters_json": {
                "dataset": "pricing",
                "columns": ["price_date", "asset"],
            },
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Dataset override is only supported for customizable report templates."
