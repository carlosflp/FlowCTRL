import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import ManageAccessUser, ReadAccessUser, WriteAccessUser
from app.modules.reports.schemas import (
    ReportExecutionCreate,
    ReportExecutionRead,
    ReportTemplateCreate,
    ReportTemplateRead,
    ReportTemplateUpdate,
)
from app.modules.reports.service import (
    create_report_execution,
    create_report_template,
    get_report_download_payload,
    get_report_execution_or_404,
    get_report_template_or_404,
    list_report_executions,
    list_report_templates,
    update_report_template,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/templates", response_model=list[ReportTemplateRead])
def read_report_templates(
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> list[ReportTemplateRead]:
    return list_report_templates(db)


@router.post("/templates", response_model=ReportTemplateRead, status_code=status.HTTP_201_CREATED)
def create_report_template_endpoint(
    payload: ReportTemplateCreate,
    current_user: ManageAccessUser,
    db: Session = Depends(get_db),
) -> ReportTemplateRead:
    return create_report_template(db, payload, actor_user_id=current_user.id)


@router.get("/templates/{template_id}", response_model=ReportTemplateRead)
def read_report_template(
    template_id: uuid.UUID,
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> ReportTemplateRead:
    return get_report_template_or_404(db, template_id)


@router.put("/templates/{template_id}", response_model=ReportTemplateRead)
def update_report_template_endpoint(
    template_id: uuid.UUID,
    payload: ReportTemplateUpdate,
    current_user: ManageAccessUser,
    db: Session = Depends(get_db),
) -> ReportTemplateRead:
    template = get_report_template_or_404(db, template_id)
    return update_report_template(db, template, payload, actor_user_id=current_user.id)


@router.get("/executions", response_model=list[ReportExecutionRead])
def read_report_executions(
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
    portfolio_id: uuid.UUID | None = Query(default=None),
) -> list[ReportExecutionRead]:
    return list_report_executions(db, current_user=current_user, portfolio_id=portfolio_id)


@router.post("/executions", response_model=ReportExecutionRead, status_code=status.HTTP_201_CREATED)
def create_report_execution_endpoint(
    payload: ReportExecutionCreate,
    current_user: WriteAccessUser,
    db: Session = Depends(get_db),
) -> ReportExecutionRead:
    return create_report_execution(
        db,
        payload,
        current_user=current_user,
        actor_user_id=current_user.id,
    )


@router.get("/executions/{execution_id}", response_model=ReportExecutionRead)
def read_report_execution(
    execution_id: uuid.UUID,
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> ReportExecutionRead:
    return get_report_execution_or_404(db, execution_id, current_user=current_user)


@router.get("/executions/{execution_id}/download")
def download_report_execution(
    execution_id: uuid.UUID,
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> Response:
    filename, file_type, content = get_report_download_payload(
        db,
        execution_id,
        current_user=current_user,
    )
    media_types = {
        "csv": "text/csv",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pdf": "application/pdf",
    }
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(
        content=content,
        media_type=media_types.get(file_type, "application/octet-stream"),
        headers=headers,
    )
