"""Add user roles."""

from alembic import op
import sqlalchemy as sa


revision = "20260513_0002"
down_revision = "20260511_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = sa.Enum(
        "admin",
        "manager",
        "analyst",
        "viewer",
        name="user_role",
        native_enum=False,
    )
    user_role.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "users",
        sa.Column("role", user_role, nullable=False, server_default="viewer"),
    )
    op.execute("UPDATE users SET role = 'admin' WHERE is_superuser = true")
    op.alter_column("users", "role", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "role")
    sa.Enum(
        "admin",
        "manager",
        "analyst",
        "viewer",
        name="user_role",
        native_enum=False,
    ).drop(op.get_bind(), checkfirst=True)
