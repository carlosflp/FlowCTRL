import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, money_column

if TYPE_CHECKING:
    from app.modules.assets.models import Asset


class AssetPrice(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "asset_prices"
    __table_args__ = (
        UniqueConstraint(
            "asset_id",
            "price_date",
            "source",
            name="uq_asset_prices_asset_date_source",
        ),
    )

    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id"), nullable=False)
    price_date: Mapped[date] = mapped_column(Date, nullable=False)
    price: Mapped[Decimal] = money_column()
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    is_validated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    asset: Mapped["Asset"] = relationship(back_populates="prices")
