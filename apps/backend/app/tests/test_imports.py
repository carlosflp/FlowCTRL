import uuid

from fastapi.testclient import TestClient

from app.modules.imports.service import process_import_job_in_session


def create_portfolio(client: TestClient, headers: dict[str, str]) -> dict[str, object]:
    return client.post(
        "/api/v1/portfolios",
        json={
            "name": "Import Fund",
            "description": "Carteira para testes de importacao.",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=headers,
    ).json()


def create_asset(
    client: TestClient,
    headers: dict[str, str],
    *,
    ticker: str,
) -> dict[str, object]:
    return client.post(
        "/api/v1/assets",
        json={
            "ticker": ticker,
            "name": f"Ativo {ticker}",
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "CDI",
            "maturity_date": "2035-01-01",
            "is_active": True,
        },
        headers=headers,
    ).json()


def test_upload_import_job_creates_preview_and_queues_processing(
    client: TestClient,
    admin_auth_headers: dict[str, str],
    monkeypatch,
) -> None:
    portfolio = create_portfolio(client, admin_auth_headers)
    create_asset(client, admin_auth_headers, ticker="IMP-OPS-1")
    queued_job_ids: list[str] = []
    uploaded_objects: list[str] = []

    monkeypatch.setattr(
        "app.modules.imports.service.queue_import_job",
        lambda job_id: queued_job_ids.append(str(job_id)),
    )
    monkeypatch.setattr(
        "app.modules.imports.service.upload_import_content",
        lambda **kwargs: uploaded_objects.append(kwargs["object_name"]) or kwargs["object_name"],
    )

    content = (
        "asset_ticker,operation_type,trade_date,settlement_date,quantity,unit_price,status\n"
        "IMP-OPS-1,buy,2026-05-10,2026-05-12,10,100.50,approved\n"
    ).encode("utf-8")

    response = client.post(
        "/api/v1/imports/upload",
        data={
            "dataset": "operations",
            "source": "manual_upload",
            "portfolio_id": portfolio["id"],
        },
        files={"file": ("operations.csv", content, "text/csv")},
        headers=admin_auth_headers,
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "queued"
    assert payload["dataset"] == "operations"
    assert payload["source"] == "manual_upload"
    assert payload["total_rows"] == 1
    assert payload["preview_rows_json"][0]["asset_ticker"] == "IMP-OPS-1"
    assert queued_job_ids == [payload["id"]]
    assert len(uploaded_objects) == 1
    assert uploaded_objects[0].startswith(f"imports/{payload['id']}/")


def test_process_import_job_imports_operations_and_tracks_row_errors(
    client: TestClient,
    admin_auth_headers: dict[str, str],
    db_session,
    monkeypatch,
) -> None:
    portfolio = create_portfolio(client, admin_auth_headers)
    create_asset(client, admin_auth_headers, ticker="VALID-OPS")

    monkeypatch.setattr("app.modules.imports.service.queue_import_job", lambda job_id: None)
    monkeypatch.setattr(
        "app.modules.imports.service.upload_import_content",
        lambda **kwargs: kwargs["object_name"],
    )

    content = (
        "ticker,tipo,data_trade,data_liquidacao,quantidade,preco_unitario,status\n"
        "VALID-OPS,buy,2026-05-10,2026-05-11,5,101.25,approved\n"
        "MISSING-OPS,buy,2026-05-10,2026-05-11,2,99.10,approved\n"
    ).encode("utf-8")

    upload_response = client.post(
        "/api/v1/imports/upload",
        data={
            "dataset": "operations",
            "source": "administrator_file",
            "portfolio_id": portfolio["id"],
        },
        files={"file": ("operations.csv", content, "text/csv")},
        headers=admin_auth_headers,
    )

    assert upload_response.status_code == 201
    job_id = upload_response.json()["id"]

    monkeypatch.setattr(
        "app.modules.imports.service.download_import_content",
        lambda object_name: content,
    )

    process_import_job_in_session(db_session, uuid.UUID(job_id))
    db_session.expire_all()

    job_response = client.get(f"/api/v1/imports/{job_id}", headers=admin_auth_headers)
    assert job_response.status_code == 200
    job_payload = job_response.json()
    assert job_payload["status"] == "completed_with_errors"
    assert job_payload["successful_rows"] == 1
    assert job_payload["failed_rows"] == 1
    assert "Asset 'MISSING-OPS' was not found." in job_payload["result_json"]["errors"][0]["message"]

    operations_response = client.get(
        f"/api/v1/operations?portfolio_id={portfolio['id']}",
        headers=admin_auth_headers,
    )
    assert operations_response.status_code == 200
    operations = operations_response.json()
    assert len(operations) == 1
    assert operations[0]["asset"]["ticker"] == "VALID-OPS"
