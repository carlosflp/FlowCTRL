"""Initial schema."""

from alembic import op
import sqlalchemy as sa


revision = "20260511_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    asset_type = sa.Enum(
        "cash",
        "stock",
        "bond",
        "fund",
        "fixed_income",
        "debenture",
        "cri",
        "cra",
        "etf",
        "derivative",
        "other",
        name="asset_type",
        native_enum=False,
    )
    operation_type = sa.Enum(
        "buy",
        "sell",
        "contribution",
        "redemption",
        "dividend",
        "interest",
        "coupon",
        "amortization",
        "fee",
        "tax",
        "adjustment",
        "transfer",
        name="operation_type",
        native_enum=False,
    )
    operation_status = sa.Enum(
        "draft",
        "pending_approval",
        "approved",
        "settled",
        "cancelled",
        "rejected",
        name="operation_status",
        native_enum=False,
    )
    cashflow_entry_type = sa.Enum(
        "inflow",
        "outflow",
        "transfer",
        "adjustment",
        name="cashflow_entry_type",
        native_enum=False,
    )
    cashflow_status = sa.Enum(
        "pending",
        "settled",
        "cancelled",
        name="cashflow_status",
        native_enum=False,
    )
    report_template_type = sa.Enum("csv", "xlsx", "pdf", name="report_template_type", native_enum=False)
    report_execution_status = sa.Enum(
        "queued",
        "running",
        "completed",
        "failed",
        name="report_execution_status",
        native_enum=False,
    )

    op.create_table(
        "users",
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)

    op.create_table(
        "portfolios",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("base_currency", sa.String(length=8), nullable=False),
        sa.Column("benchmark", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_portfolios")),
        sa.UniqueConstraint("name", name=op.f("uq_portfolios_name")),
    )
    op.create_index(op.f("ix_portfolios_name"), "portfolios", ["name"], unique=False)

    op.create_table(
        "assets",
        sa.Column("ticker", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("asset_type", asset_type, nullable=False),
        sa.Column("issuer", sa.String(length=255), nullable=True),
        sa.Column("indexer", sa.String(length=64), nullable=True),
        sa.Column("maturity_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_assets")),
        sa.UniqueConstraint("ticker", name=op.f("uq_assets_ticker")),
    )
    op.create_index(op.f("ix_assets_ticker"), "assets", ["ticker"], unique=False)

    op.create_table(
        "report_templates",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("template_type", report_template_type, nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_report_templates")),
        sa.UniqueConstraint("name", name=op.f("uq_report_templates_name")),
    )

    op.create_table(
        "operations",
        sa.Column("portfolio_id", sa.Uuid(), nullable=False),
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column("operation_type", operation_type, nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("settlement_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 8), nullable=False),
        sa.Column("unit_price", sa.Numeric(18, 4), nullable=False),
        sa.Column("gross_value", sa.Numeric(18, 4), nullable=False),
        sa.Column("net_value", sa.Numeric(18, 4), nullable=False),
        sa.Column("fees", sa.Numeric(18, 4), nullable=False),
        sa.Column("taxes", sa.Numeric(18, 4), nullable=False),
        sa.Column("status", operation_status, nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"], name=op.f("fk_operations_asset_id_assets")),
        sa.ForeignKeyConstraint(
            ["portfolio_id"],
            ["portfolios.id"],
            name=op.f("fk_operations_portfolio_id_portfolios"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_operations")),
    )

    op.create_table(
        "audit_logs",
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("old_value_json", sa.JSON(), nullable=True),
        sa.Column("new_value_json", sa.JSON(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_audit_logs_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
    )
    op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"], unique=False)

    op.create_table(
        "asset_prices",
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column("price_date", sa.Date(), nullable=False),
        sa.Column("price", sa.Numeric(18, 4), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("is_validated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"], name=op.f("fk_asset_prices_asset_id_assets")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_asset_prices")),
        sa.UniqueConstraint(
            "asset_id",
            "price_date",
            "source",
            name="uq_asset_prices_asset_date_source",
        ),
    )

    op.create_table(
        "report_executions",
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("portfolio_id", sa.Uuid(), nullable=True),
        sa.Column("status", report_execution_status, nullable=False),
        sa.Column("parameters_json", sa.JSON(), nullable=True),
        sa.Column("file_path", sa.String(length=512), nullable=True),
        sa.Column("file_type", sa.String(length=16), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["portfolio_id"],
            ["portfolios.id"],
            name=op.f("fk_report_executions_portfolio_id_portfolios"),
        ),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["report_templates.id"],
            name=op.f("fk_report_executions_template_id_report_templates"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_report_executions")),
    )

    op.create_table(
        "cashflow_entries",
        sa.Column("portfolio_id", sa.Uuid(), nullable=False),
        sa.Column("operation_id", sa.Uuid(), nullable=True),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("settlement_date", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("entry_type", cashflow_entry_type, nullable=False),
        sa.Column("status", cashflow_status, nullable=False),
        sa.Column("amount", sa.Numeric(18, 4), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["operation_id"],
            ["operations.id"],
            name=op.f("fk_cashflow_entries_operation_id_operations"),
        ),
        sa.ForeignKeyConstraint(
            ["portfolio_id"],
            ["portfolios.id"],
            name=op.f("fk_cashflow_entries_portfolio_id_portfolios"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cashflow_entries")),
    )


def downgrade() -> None:
    op.drop_table("cashflow_entries")
    op.drop_table("report_executions")
    op.drop_table("asset_prices")
    op.drop_index(op.f("ix_audit_logs_entity_type"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_id"), table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_table("operations")
    op.drop_table("report_templates")
    op.drop_index(op.f("ix_assets_ticker"), table_name="assets")
    op.drop_table("assets")
    op.drop_index(op.f("ix_portfolios_name"), table_name="portfolios")
    op.drop_table("portfolios")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
