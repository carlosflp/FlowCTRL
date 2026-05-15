import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.assets.models import Asset
from app.modules.operations.models import Operation
from app.modules.portfolios.service import (
    ensure_user_has_portfolio_access,
    get_accessible_portfolio_ids,
    user_has_global_portfolio_access,
)
from app.modules.assets.schemas import AssetCreate, AssetUpdate
from app.modules.users.models import User


def get_accessible_asset_ids(
    db: Session,
    *,
    current_user: User,
    portfolio_id: uuid.UUID | None = None,
) -> list[uuid.UUID] | None:
    if portfolio_id is not None:
        ensure_user_has_portfolio_access(
            db,
            current_user=current_user,
            portfolio_id=portfolio_id,
        )
        statement = (
            select(Operation.asset_id)
            .where(Operation.portfolio_id == portfolio_id)
            .distinct()
            .order_by(Operation.asset_id.asc())
        )
        return list(db.scalars(statement))

    if user_has_global_portfolio_access(current_user):
        return None

    accessible_portfolio_ids = get_accessible_portfolio_ids(db, current_user)
    if not accessible_portfolio_ids:
        return []

    statement = (
        select(Operation.asset_id)
        .where(Operation.portfolio_id.in_(accessible_portfolio_ids))
        .distinct()
        .order_by(Operation.asset_id.asc())
    )
    return list(db.scalars(statement))


def list_assets(
    db: Session,
    *,
    current_user: User,
    portfolio_id: uuid.UUID | None = None,
) -> list[Asset]:
    accessible_asset_ids = get_accessible_asset_ids(
        db,
        current_user=current_user,
        portfolio_id=portfolio_id,
    )
    statement = select(Asset).order_by(Asset.ticker)
    if accessible_asset_ids is not None:
        if not accessible_asset_ids:
            return []
        statement = statement.where(Asset.id.in_(accessible_asset_ids))
    return list(db.scalars(statement))


def get_asset_or_404(
    db: Session,
    asset_id: uuid.UUID,
    *,
    current_user: User | None = None,
) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    if current_user is not None:
        accessible_asset_ids = get_accessible_asset_ids(db, current_user=current_user)
        if accessible_asset_ids is not None and asset.id not in set(accessible_asset_ids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this asset.",
            )
    return asset


def create_asset(db: Session, payload: AssetCreate) -> Asset:
    asset = Asset(**payload.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def update_asset(db: Session, asset: Asset, payload: AssetUpdate) -> Asset:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def delete_asset(db: Session, asset: Asset) -> None:
    db.delete(asset)
    db.commit()
