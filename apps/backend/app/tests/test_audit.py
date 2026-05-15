from datetime import datetime, timezone

from app.core.enums import AuditAction
from app.modules.audit.service import create_audit_log


def test_admin_can_list_audit_logs_with_filters(
    client,
    db_session,
    admin_user,
    viewer_user,
    admin_auth_headers,
):
    older_log = create_audit_log(
        db_session,
        entity_type="operation",
        entity_id="old-op",
        action=AuditAction.CREATED,
        new_value={"status": "draft"},
        user_id=admin_user.id,
    )
    older_log.created_at = datetime(2026, 5, 10, 12, 0, tzinfo=timezone.utc)

    newest_log = create_audit_log(
        db_session,
        entity_type="report_execution",
        entity_id="exec-123",
        action=AuditAction.UPDATED,
        new_value={"status": "completed"},
        old_value={"status": "running"},
        user_id=viewer_user.id,
    )
    newest_log.created_at = datetime(2026, 5, 15, 9, 30, tzinfo=timezone.utc)
    db_session.commit()

    response = client.get(
        "/api/v1/audit",
        params={
            "action": "updated",
            "user_id": str(viewer_user.id),
            "search": "exec-123",
            "date_from": "2026-05-15",
        },
        headers=admin_auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["entity_type"] == "report_execution"
    assert payload[0]["entity_id"] == "exec-123"
    assert payload[0]["action"] == "updated"
    assert payload[0]["user"]["id"] == str(viewer_user.id)
    assert payload[0]["user"]["email"] == viewer_user.email


def test_audit_logs_are_ordered_by_most_recent_first(
    client,
    db_session,
    admin_user,
    admin_auth_headers,
):
    oldest_log = create_audit_log(
        db_session,
        entity_type="user",
        entity_id="user-1",
        action=AuditAction.CREATED,
        user_id=admin_user.id,
    )
    oldest_log.created_at = datetime(2026, 5, 11, 8, 0, tzinfo=timezone.utc)

    newest_log = create_audit_log(
        db_session,
        entity_type="user",
        entity_id="user-2",
        action=AuditAction.UPDATED,
        user_id=admin_user.id,
    )
    newest_log.created_at = datetime(2026, 5, 12, 8, 0, tzinfo=timezone.utc)
    db_session.commit()

    response = client.get("/api/v1/audit", headers=admin_auth_headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["entity_id"] == "user-2"
    assert payload[1]["entity_id"] == "user-1"


def test_non_admin_cannot_list_audit_logs(client, viewer_auth_headers):
    response = client.get("/api/v1/audit", headers=viewer_auth_headers)

    assert response.status_code == 403
