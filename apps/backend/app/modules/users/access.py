from sqlalchemy import Column, ForeignKey, Table

from app.db.base import Base

user_portfolio_access_table = Table(
    "user_portfolio_accesses",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("portfolio_id", ForeignKey("portfolios.id", ondelete="CASCADE"), primary_key=True),
)
