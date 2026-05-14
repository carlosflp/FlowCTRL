import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import AuditAction
from app.modules.audit.models import AuditLog
from app.modules.users.models import User


def get_latest_audit_log(
    db_session: Session,
    *,
    entity_type: str,
    entity_id: str,
    action: AuditAction,
) -> AuditLog:
    statement = (
        select(AuditLog)
        .where(
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id,
            AuditLog.action == action.value,
        )
        .order_by(AuditLog.created_at.desc())
    )
    audit_log = db_session.scalar(statement)
    assert audit_log is not None
    return audit_log


def create_portfolio(client: TestClient, admin_auth_headers: dict[str, str], name: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/portfolios",
        json={
            "name": name,
            "description": f"{name} description",
            "base_currency": "BRL",
            "benchmark": "CDI",
            "is_active": True,
        },
        headers=admin_auth_headers,
    )
    return response.json()


def create_asset(client: TestClient, admin_auth_headers: dict[str, str], ticker: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/assets",
        json={
            "ticker": ticker,
            "name": f"{ticker} Asset",
            "asset_type": "bond",
            "issuer": "Issuer",
            "indexer": "CDI",
            "maturity_date": "2035-01-01",
            "is_active": True,
        },
        headers=admin_auth_headers,
    )
    return response.json()


def test_operation_audit_logs_record_authenticated_actor(
    client: TestClient,
    db_session: Session,
    admin_user: User,
    admin_auth_headers: dict[str, str],
) -> None:
    portfolio = create_portfolio(client, admin_auth_headers, "Audit Operations")
    asset = create_asset(client, admin_auth_headers, "AUD-OPS-01")

    created = client.post(
        "/api/v1/operations",
        json={
            "portfolio_id": portfolio["id"],
            "asset_id": asset["id"],
            "operation_type": "buy",
            "trade_date": "2026-05-10",
            "settlement_date": "2026-05-12",
            "quantity": "100",
            "unit_price": "101.25",
            "fees": "2.50",
            "taxes": "0",
            "status": "approved",
            "notes": "audit create",
        },
        headers=admin_auth_headers,
    ).json()

    updated = client.put(
        f"/api/v1/operations/{created['id']}",
        json={"notes": "audit updated"},
        headers=admin_auth_headers,
    )
    deleted = client.delete(
        f"/api/v1/operations/{created['id']}",
        headers=admin_auth_headers,
    )

    assert updated.status_code == 200
    assert deleted.status_code == 204

    for action in (AuditAction.CREATED, AuditAction.UPDATED, AuditAction.DELETED):
        audit_log = get_latest_audit_log(
            db_session,
            entity_type="operation",
            entity_id=created["id"],
            action=action,
        )
        assert audit_log.user_id == admin_user.id


def test_cashflow_audit_logs_record_authenticated_actor(
    client: TestClient,
    db_session: Session,
    admin_user: User,
    admin_auth_headers: dict[str, str],
) -> None:
    portfolio = create_portfolio(client, admin_auth_headers, "Audit Cashflow")

    created = client.post(
        "/api/v1/cashflow",
        json={
            "portfolio_id": portfolio["id"],
            "entry_date": "2026-05-13",
            "settlement_date": "2026-05-14",
            "description": "audit cashflow",
            "entry_type": "inflow",
            "amount": "1500.00",
            "status": "pending",
        },
        headers=admin_auth_headers,
    ).json()

    updated = client.put(
        f"/api/v1/cashflow/{created['id']}",
        json={"status": "settled"},
        headers=admin_auth_headers,
    )

    assert updated.status_code == 200

    for action in (AuditAction.CREATED, AuditAction.UPDATED):
        audit_log = get_latest_audit_log(
            db_session,
            entity_type="cashflow_entry",
            entity_id=created["id"],
            action=action,
        )
        assert audit_log.user_id == admin_user.id


def test_pricing_audit_logs_record_authenticated_actor(
    client: TestClient,
    db_session: Session,
    admin_user: User,
    admin_auth_headers: dict[str, str],
) -> None:
    asset = create_asset(client, admin_auth_headers, "AUD-PRC-01")

    created = client.post(
        "/api/v1/pricing",
        json={
            "asset_id": asset["id"],
            "price_date": "2026-05-13",
            "price": "98.10",
            "source": "manual",
            "is_validated": False,
        },
        headers=admin_auth_headers,
    ).json()

    updated = client.put(
        f"/api/v1/pricing/{created['id']}",
        json={"is_validated": True},
        headers=admin_auth_headers,
    )

    assert updated.status_code == 200

    for action in (AuditAction.CREATED, AuditAction.UPDATED):
        audit_log = get_latest_audit_log(
            db_session,
            entity_type="asset_price",
            entity_id=created["id"],
            action=action,
        )
        assert audit_log.user_id == admin_user.id


def test_report_audit_logs_record_authenticated_actor(
    client: TestClient,
    db_session: Session,
    admin_user: User,
    admin_auth_headers: dict[str, str],
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        "app.modules.reports.service.queue_report_execution",
        lambda execution_id: None,
    )

    template = client.post(
        "/api/v1/reports/templates",
        json={
            "name": "Audit Report Template",
            "description": "Template para auditoria",
            "template_type": "xlsx",
            "config_json": {"dataset": "operations"},
            "is_active": True,
        },
        headers=admin_auth_headers,
    ).json()

    updated = client.put(
        f"/api/v1/reports/templates/{template['id']}",
        json={"description": "Template para auditoria atualizado"},
        headers=admin_auth_headers,
    )
    execution = client.post(
        "/api/v1/reports/executions",
        json={
            "template_id": template["id"],
            "portfolio_id": None,
            "file_type": "csv",
            "parameters_json": {"columns": ["trade_date", "portfolio", "status"]},
        },
        headers=admin_auth_headers,
    ).json()

    assert updated.status_code == 200

    template_created_log = get_latest_audit_log(
        db_session,
        entity_type="report_template",
        entity_id=template["id"],
        action=AuditAction.CREATED,
    )
    template_updated_log = get_latest_audit_log(
        db_session,
        entity_type="report_template",
        entity_id=template["id"],
        action=AuditAction.UPDATED,
    )
    execution_created_log = get_latest_audit_log(
        db_session,
        entity_type="report_execution",
        entity_id=execution["id"],
        action=AuditAction.CREATED,
    )

    assert template_created_log.user_id == admin_user.id
    assert template_updated_log.user_id == admin_user.id
    assert execution_created_log.user_id == admin_user.id
