"""add invoices and entries tables

Revision ID: 20260216_0004
Revises: 20260216_0003
Create Date: 2026-02-16

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260216_0004"
down_revision: str | None = "20260216_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("invoices"):
        op.create_table(
            "invoices",
            sa.Column("guid", sa.String(length=36), primary_key=True),
            sa.Column("book_id", sa.String(length=36), sa.ForeignKey("books.id"), nullable=False),
            sa.Column("id", sa.String(length=2048), nullable=False),
            sa.Column("invoice_type", sa.String(length=32), nullable=False),
            sa.Column("date_opened", sa.DateTime(timezone=True), nullable=True),
            sa.Column("date_posted", sa.DateTime(timezone=True), nullable=True),
            sa.Column("notes", sa.String(length=2048), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=False),
            sa.Column("currency_guid", sa.String(length=36), sa.ForeignKey("commodities.id"), nullable=False),
            sa.Column("owner_type", sa.String(length=32), nullable=False),
            sa.Column("owner_guid", sa.String(length=36), sa.ForeignKey("customers.guid"), nullable=False),
            sa.Column("terms", sa.String(length=36), nullable=True),
            sa.Column("billing_id", sa.String(length=2048), nullable=True),
            sa.Column("post_txn", sa.String(length=36), nullable=True),
            sa.Column("post_lot", sa.String(length=36), nullable=True),
            sa.Column("post_acc", sa.String(length=36), nullable=True),
            sa.Column("billto_type", sa.Integer(), nullable=True),
            sa.Column("billto_guid", sa.String(length=36), nullable=True),
            sa.Column("charge_amt_num", sa.BigInteger(), nullable=True),
            sa.Column("charge_amt_denom", sa.BigInteger(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        inspector = sa.inspect(bind)

    if inspector.has_table("invoices"):
        if not _index_exists(inspector, "invoices", "ix_invoices_book_id"):
            op.create_index("ix_invoices_book_id", "invoices", ["book_id"])
        if not _index_exists(inspector, "invoices", "ix_invoices_currency_guid"):
            op.create_index("ix_invoices_currency_guid", "invoices", ["currency_guid"])
        if not _index_exists(inspector, "invoices", "ix_invoices_owner_guid"):
            op.create_index("ix_invoices_owner_guid", "invoices", ["owner_guid"])
        if not _index_exists(inspector, "invoices", "ix_invoices_book_date_opened"):
            op.create_index("ix_invoices_book_date_opened", "invoices", ["book_id", "date_opened"])

    if not inspector.has_table("entries"):
        op.create_table(
            "entries",
            sa.Column("guid", sa.String(length=36), primary_key=True),
            sa.Column("date", sa.DateTime(timezone=True), nullable=False),
            sa.Column("date_entered", sa.DateTime(timezone=True), nullable=True),
            sa.Column("description", sa.String(length=2048), nullable=True),
            sa.Column("action", sa.String(length=2048), nullable=True),
            sa.Column("notes", sa.String(length=2048), nullable=True),
            sa.Column("quantity_num", sa.BigInteger(), nullable=False),
            sa.Column("quantity_denom", sa.BigInteger(), nullable=False),
            sa.Column("i_acct", sa.String(length=36), sa.ForeignKey("accounts.id"), nullable=False),
            sa.Column("i_price_num", sa.BigInteger(), nullable=False),
            sa.Column("i_price_denom", sa.BigInteger(), nullable=False),
            sa.Column("i_discount_num", sa.BigInteger(), nullable=False),
            sa.Column("i_discount_denom", sa.BigInteger(), nullable=False),
            sa.Column("invoice", sa.String(length=36), sa.ForeignKey("invoices.guid", ondelete="CASCADE"), nullable=False),
            sa.Column("i_disc_type", sa.String(length=32), nullable=False),
            sa.Column("i_disc_how", sa.String(length=32), nullable=False),
            sa.Column("i_taxable", sa.Boolean(), nullable=False),
            sa.Column("i_taxincluded", sa.Boolean(), nullable=False),
            sa.Column("i_taxtable", sa.String(length=36), nullable=True),
            sa.Column("b_paytype", sa.Integer(), nullable=True),
            sa.Column("billable", sa.Boolean(), nullable=True),
            sa.Column("billto_type", sa.Integer(), nullable=True),
            sa.Column("billto_guid", sa.String(length=36), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("quantity_denom > 0", name="ck_entries_quantity_denom_positive"),
            sa.CheckConstraint("i_price_denom > 0", name="ck_entries_price_denom_positive"),
            sa.CheckConstraint("i_discount_denom > 0", name="ck_entries_discount_denom_positive"),
        )
        inspector = sa.inspect(bind)

    if inspector.has_table("entries"):
        if not _index_exists(inspector, "entries", "ix_entries_i_acct"):
            op.create_index("ix_entries_i_acct", "entries", ["i_acct"])
        if not _index_exists(inspector, "entries", "ix_entries_invoice"):
            op.create_index("ix_entries_invoice", "entries", ["invoice"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("entries"):
        if _index_exists(inspector, "entries", "ix_entries_invoice"):
            op.drop_index("ix_entries_invoice", table_name="entries")
        if _index_exists(inspector, "entries", "ix_entries_i_acct"):
            op.drop_index("ix_entries_i_acct", table_name="entries")
        op.drop_table("entries")
        inspector = sa.inspect(bind)

    if inspector.has_table("invoices"):
        if _index_exists(inspector, "invoices", "ix_invoices_book_date_opened"):
            op.drop_index("ix_invoices_book_date_opened", table_name="invoices")
        if _index_exists(inspector, "invoices", "ix_invoices_owner_guid"):
            op.drop_index("ix_invoices_owner_guid", table_name="invoices")
        if _index_exists(inspector, "invoices", "ix_invoices_currency_guid"):
            op.drop_index("ix_invoices_currency_guid", table_name="invoices")
        if _index_exists(inspector, "invoices", "ix_invoices_book_id"):
            op.drop_index("ix_invoices_book_id", table_name="invoices")
        op.drop_table("invoices")
