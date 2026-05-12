from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import AssetType
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.modules.operations.models import Operation
    from app.modules.pricing.models import AssetPrice


class Asset(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "assets"

    ticker: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[AssetType] = mapped_column(
        Enum(AssetType, name="asset_type", native_enum=False),
        nullable=False,
    )
    issuer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    indexer: Mapped[str | None] = mapped_column(String(64), nullable=True)
    maturity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    operations: Mapped[list["Operation"]] = relationship(back_populates="asset")
    prices: Mapped[list["AssetPrice"]] = relationship(back_populates="asset")
