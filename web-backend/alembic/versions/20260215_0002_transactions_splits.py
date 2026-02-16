"""add transactions and splits tables

Revision ID: 20260215_0002
Revises: 062123514e26
Create Date: 2026-02-15

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260215_0002"
down_revision: str | None = "062123514e26"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("transactions"):
        op.create_table(
            "transactions",
            sa.Column("guid", sa.String(length=36), primary_key=True),
            sa.Column("currency_guid", sa.String(length=36), sa.ForeignKey("commodities.id"), nullable=False),
            sa.Column("num", sa.String(length=2048), nullable=False),
            sa.Column("post_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("enter_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("description", sa.String(length=2048), nullable=True),
        )
        inspector = sa.inspect(bind)

    if inspector.has_table("transactions"):
        if not _index_exists(inspector, "transactions", "ix_transactions_currency_guid"):
            op.create_index("ix_transactions_currency_guid", "transactions", ["currency_guid"])
        if not _index_exists(inspector, "transactions", "ix_transactions_post_date"):
            op.create_index("ix_transactions_post_date", "transactions", ["post_date"])

    if not inspector.has_table("splits"):
        op.create_table(
            "splits",
            sa.Column("guid", sa.String(length=36), primary_key=True),
            sa.Column("tx_guid", sa.String(length=36), sa.ForeignKey("transactions.guid", ondelete="CASCADE"), nullable=False),
            sa.Column("account_guid", sa.String(length=36), sa.ForeignKey("accounts.id"), nullable=False),
            sa.Column("memo", sa.String(length=2048), nullable=False),
            sa.Column("action", sa.String(length=2048), nullable=False),
            sa.Column("reconcile_state", sa.String(length=1), nullable=False),
            sa.Column("reconcile_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("value_num", sa.BigInteger(), nullable=False),
            sa.Column("value_denom", sa.BigInteger(), nullable=False),
            sa.Column("quantity_num", sa.BigInteger(), nullable=False),
            sa.Column("quantity_denom", sa.BigInteger(), nullable=False),
            sa.Column("lot_guid", sa.String(length=36), nullable=True),
            sa.CheckConstraint("value_denom > 0", name="ck_splits_value_denom_positive"),
            sa.CheckConstraint("quantity_denom > 0", name="ck_splits_quantity_denom_positive"),
        )
        inspector = sa.inspect(bind)

    if inspector.has_table("splits"):
        if not _index_exists(inspector, "splits", "ix_splits_tx_guid"):
            op.create_index("ix_splits_tx_guid", "splits", ["tx_guid"])
        if not _index_exists(inspector, "splits", "ix_splits_account_guid"):
            op.create_index("ix_splits_account_guid", "splits", ["account_guid"])


def downgrade() -> None:
    op.drop_index("ix_splits_account_guid", table_name="splits")
    op.drop_index("ix_splits_tx_guid", table_name="splits")
    op.drop_table("splits")

    op.drop_index("ix_transactions_post_date", table_name="transactions")
    op.drop_index("ix_transactions_currency_guid", table_name="transactions")
    op.drop_table("transactions")
