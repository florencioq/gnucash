"""add default income/expense accounts to customers and vendors

Revision ID: 20260218_0011
Revises: 20260218_0010
Create Date: 2026-02-18 16:20:00.000000

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260218_0011"
down_revision: str | None = "20260218_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("customers") and not _column_exists(inspector, "customers", "income_account_guid"):
        op.add_column(
            "customers",
            sa.Column(
                "income_account_guid",
                sa.String(length=36),
                sa.ForeignKey("accounts.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        inspector = sa.inspect(bind)

    if inspector.has_table("customers") and not _index_exists(inspector, "customers", "ix_customers_income_account_guid"):
        op.create_index("ix_customers_income_account_guid", "customers", ["income_account_guid"])

    if inspector.has_table("vendors") and not _column_exists(inspector, "vendors", "expense_account_guid"):
        op.add_column(
            "vendors",
            sa.Column(
                "expense_account_guid",
                sa.String(length=36),
                sa.ForeignKey("accounts.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        inspector = sa.inspect(bind)

    if inspector.has_table("vendors") and not _index_exists(inspector, "vendors", "ix_vendors_expense_account_guid"):
        op.create_index("ix_vendors_expense_account_guid", "vendors", ["expense_account_guid"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("vendors") and _index_exists(inspector, "vendors", "ix_vendors_expense_account_guid"):
        op.drop_index("ix_vendors_expense_account_guid", table_name="vendors")
        inspector = sa.inspect(bind)

    if inspector.has_table("vendors") and _column_exists(inspector, "vendors", "expense_account_guid"):
        op.drop_column("vendors", "expense_account_guid")
        inspector = sa.inspect(bind)

    if inspector.has_table("customers") and _index_exists(inspector, "customers", "ix_customers_income_account_guid"):
        op.drop_index("ix_customers_income_account_guid", table_name="customers")
        inspector = sa.inspect(bind)

    if inspector.has_table("customers") and _column_exists(inspector, "customers", "income_account_guid"):
        op.drop_column("customers", "income_account_guid")
