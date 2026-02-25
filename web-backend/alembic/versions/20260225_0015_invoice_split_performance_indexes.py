"""add performance indexes for invoice/split lookup paths

Revision ID: 20260225_0015
Revises: 20260221_0014
Create Date: 2026-02-25

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260225_0015"
down_revision: str | None = "20260221_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("invoices"):
        if not _index_exists(inspector, "invoices", "ix_invoices_post_txn"):
            op.create_index("ix_invoices_post_txn", "invoices", ["post_txn"])
        if not _index_exists(inspector, "invoices", "ix_invoices_post_lot"):
            op.create_index("ix_invoices_post_lot", "invoices", ["post_lot"])
        if not _index_exists(inspector, "invoices", "ix_invoices_book_owner_type_date_posted"):
            op.create_index(
                "ix_invoices_book_owner_type_date_posted",
                "invoices",
                ["book_id", "owner_type", "date_posted"],
            )

    if inspector.has_table("splits") and not _index_exists(
        inspector, "splits", "ix_splits_lot_guid_account_guid"
    ):
        op.create_index("ix_splits_lot_guid_account_guid", "splits", ["lot_guid", "account_guid"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("splits") and _index_exists(inspector, "splits", "ix_splits_lot_guid_account_guid"):
        op.drop_index("ix_splits_lot_guid_account_guid", table_name="splits")

    if inspector.has_table("invoices"):
        if _index_exists(inspector, "invoices", "ix_invoices_book_owner_type_date_posted"):
            op.drop_index("ix_invoices_book_owner_type_date_posted", table_name="invoices")
        if _index_exists(inspector, "invoices", "ix_invoices_post_lot"):
            op.drop_index("ix_invoices_post_lot", table_name="invoices")
        if _index_exists(inspector, "invoices", "ix_invoices_post_txn"):
            op.drop_index("ix_invoices_post_txn", table_name="invoices")
