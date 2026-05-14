import uuid

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import AuditAction
from app.db.utils import model_to_dict
from app.modules.assets.models import Asset
from app.modules.audit.service import create_audit_log
from app.modules.pricing.models import AssetPrice
from app.modules.pricing.schemas import AssetPriceCreate, AssetPriceUpdate


def list_asset_prices(db: Session) -> list[AssetPrice]:
    statement = (
        select(AssetPrice)
        .options(selectinload(AssetPrice.asset))
        .order_by(AssetPrice.price_date.desc(), AssetPrice.created_at.desc())
    )
    return list(db.scalars(statement))


def get_asset_price_or_404(db: Session, price_id: uuid.UUID) -> AssetPrice:
    statement = (
        select(AssetPrice)
        .where(AssetPrice.id == price_id)
        .options(selectinload(AssetPrice.asset))
    )
    price = db.scalar(statement)
    if price is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset price not found.")
    return price


def _ensure_asset_exists(db: Session, asset_id: uuid.UUID) -> None:
    if db.get(Asset, asset_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")


def _ensure_unique_price(
    db: Session,
    *,
    asset_id: uuid.UUID,
    price_date,
    source: str,
    ignore_id: uuid.UUID | None = None,
) -> None:
    conditions = [
        AssetPrice.asset_id == asset_id,
        AssetPrice.price_date == price_date,
        AssetPrice.source == source,
    ]
    if ignore_id is not None:
        conditions.append(AssetPrice.id != ignore_id)

    existing = db.scalar(select(AssetPrice.id).where(and_(*conditions)))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An asset price already exists for the same asset, date and source.",
        )


def create_asset_price(
    db: Session,
    payload: AssetPriceCreate,
    *,
    actor_user_id: uuid.UUID | None = None,
) -> AssetPrice:
    _ensure_asset_exists(db, payload.asset_id)
    _ensure_unique_price(
        db,
        asset_id=payload.asset_id,
        price_date=payload.price_date,
        source=payload.source,
    )

    price = AssetPrice(**payload.model_dump())
    db.add(price)
    db.flush()
    create_audit_log(
        db,
        entity_type="asset_price",
        entity_id=str(price.id),
        action=AuditAction.CREATED,
        new_value=model_to_dict(price),
        user_id=actor_user_id,
    )
    db.commit()
    return get_asset_price_or_404(db, price.id)


def update_asset_price(
    db: Session,
    price: AssetPrice,
    payload: AssetPriceUpdate,
    *,
    actor_user_id: uuid.UUID | None = None,
) -> AssetPrice:
    old_value = model_to_dict(price)
    updates = payload.model_dump(exclude_unset=True)

    new_asset_id = updates.get("asset_id", price.asset_id)
    new_price_date = updates.get("price_date", price.price_date)
    new_source = updates.get("source", price.source)
    _ensure_asset_exists(db, new_asset_id)
    _ensure_unique_price(
        db,
        asset_id=new_asset_id,
        price_date=new_price_date,
        source=new_source,
        ignore_id=price.id,
    )

    for field, value in updates.items():
        setattr(price, field, value)

    db.add(price)
    db.flush()
    create_audit_log(
        db,
        entity_type="asset_price",
        entity_id=str(price.id),
        action=AuditAction.UPDATED,
        old_value=old_value,
        new_value=model_to_dict(price),
        user_id=actor_user_id,
    )
    db.commit()
    return get_asset_price_or_404(db, price.id)


def delete_asset_price(
    db: Session,
    price: AssetPrice,
    *,
    actor_user_id: uuid.UUID | None = None,
) -> None:
    create_audit_log(
        db,
        entity_type="asset_price",
        entity_id=str(price.id),
        action=AuditAction.DELETED,
        old_value=model_to_dict(price),
        user_id=actor_user_id,
    )
    db.flush()
    db.delete(price)
    db.commit()
