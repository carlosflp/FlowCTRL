import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import DeleteAccessUser, ReadAccessUser, WriteAccessUser
from app.modules.pricing.schemas import AssetPriceCreate, AssetPriceRead, AssetPriceUpdate
from app.modules.pricing.service import (
    create_asset_price,
    delete_asset_price,
    get_asset_price_or_404,
    list_asset_prices,
    update_asset_price,
)

router = APIRouter(prefix="/pricing", tags=["pricing"])


@router.get("", response_model=list[AssetPriceRead])
def read_asset_prices(
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> list[AssetPriceRead]:
    return list_asset_prices(db)


@router.post("", response_model=AssetPriceRead, status_code=status.HTTP_201_CREATED)
def create_asset_price_endpoint(
    payload: AssetPriceCreate,
    current_user: WriteAccessUser,
    db: Session = Depends(get_db),
) -> AssetPriceRead:
    return create_asset_price(db, payload)


@router.get("/{price_id}", response_model=AssetPriceRead)
def read_asset_price(
    price_id: uuid.UUID,
    current_user: ReadAccessUser,
    db: Session = Depends(get_db),
) -> AssetPriceRead:
    return get_asset_price_or_404(db, price_id)


@router.put("/{price_id}", response_model=AssetPriceRead)
def update_asset_price_endpoint(
    price_id: uuid.UUID,
    payload: AssetPriceUpdate,
    current_user: WriteAccessUser,
    db: Session = Depends(get_db),
) -> AssetPriceRead:
    price = get_asset_price_or_404(db, price_id)
    return update_asset_price(db, price, payload)


@router.delete("/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset_price_endpoint(
    price_id: uuid.UUID,
    current_user: DeleteAccessUser,
    db: Session = Depends(get_db),
) -> Response:
    price = get_asset_price_or_404(db, price_id)
    delete_asset_price(db, price)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
