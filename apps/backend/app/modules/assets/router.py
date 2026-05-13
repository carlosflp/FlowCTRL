import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import DeleteAccessUser, ReadAccessUser, WriteAccessUser
from app.modules.assets.schemas import AssetCreate, AssetRead, AssetUpdate
from app.modules.assets.service import (
    create_asset,
    delete_asset,
    get_asset_or_404,
    list_assets,
    update_asset,
)

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetRead])
def read_assets(
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> list[AssetRead]:
    return list_assets(db)


@router.post("", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
def create_asset_endpoint(
    payload: AssetCreate,
    current_user: WriteAccessUser,
    db: Session = Depends(get_db),
) -> AssetRead:
    return create_asset(db, payload)


@router.get("/{asset_id}", response_model=AssetRead)
def read_asset(
    asset_id: uuid.UUID,
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> AssetRead:
    return get_asset_or_404(db, asset_id)


@router.put("/{asset_id}", response_model=AssetRead)
def update_asset_endpoint(
    asset_id: uuid.UUID,
    payload: AssetUpdate,
    current_user: WriteAccessUser,
    db: Session = Depends(get_db),
) -> AssetRead:
    asset = get_asset_or_404(db, asset_id)
    return update_asset(db, asset, payload)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset_endpoint(
    asset_id: uuid.UUID,
    current_user: DeleteAccessUser,
    db: Session = Depends(get_db),
) -> Response:
    asset = get_asset_or_404(db, asset_id)
    delete_asset(db, asset)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
