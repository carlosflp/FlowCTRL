"""Add user portfolio access mapping."""

from alembic import op
import sqlalchemy as sa


revision = "20260515_0003"
down_revision = "20260513_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_portfolio_accesses",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("portfolio_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "portfolio_id", name="pk_user_portfolio_accesses"),
    )


def downgrade() -> None:
    op.drop_table("user_portfolio_accesses")
