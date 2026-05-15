import uuid

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.enums import ImportDatasetType, ImportSourceType
from app.db.session import get_db
from app.modules.auth.dependencies import ReadAccessUser, WriteAccessUser
from app.modules.imports.schemas import ImportJobRead
from app.modules.imports.service import create_import_job, get_import_job_or_404, list_import_jobs

router = APIRouter(prefix="/imports", tags=["imports"])


@router.get("", response_model=list[ImportJobRead])
def read_import_jobs(
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
    portfolio_id: uuid.UUID | None = Query(default=None),
) -> list[ImportJobRead]:
    return list_import_jobs(db, current_user=current_user, portfolio_id=portfolio_id)


@router.get("/{job_id}", response_model=ImportJobRead)
def read_import_job(
    job_id: uuid.UUID,
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> ImportJobRead:
    return get_import_job_or_404(db, job_id, current_user=current_user)


@router.post("/upload", response_model=ImportJobRead, status_code=status.HTTP_201_CREATED)
def upload_import_job(
    current_user: WriteAccessUser,
    db: Session = Depends(get_db),
    dataset: ImportDatasetType = Form(...),
    source: ImportSourceType = Form(...),
    portfolio_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
) -> ImportJobRead:
    return create_import_job(
        db,
        file=file,
        dataset=dataset,
        source=source,
        portfolio_id=portfolio_id,
        current_user=current_user,
    )
