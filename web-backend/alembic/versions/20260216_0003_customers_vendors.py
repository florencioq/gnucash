"""add customers and vendors tables

Revision ID: 20260216_0003
Revises: 20260215_0002
Create Date: 2026-02-16

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260216_0003"
down_revision: str | None = "20260215_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("customers"):
        op.create_table(
            "customers",
            sa.Column("guid", sa.String(length=36), primary_key=True),
            sa.Column("book_id", sa.String(length=36), sa.ForeignKey("books.id"), nullable=False),
            sa.Column("name", sa.String(length=2048), nullable=False),
            sa.Column("id", sa.String(length=2048), nullable=False),
            sa.Column("notes", sa.String(length=2048), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=False),
            sa.Column("discount_num", sa.BigInteger(), nullable=False),
            sa.Column("discount_denom", sa.BigInteger(), nullable=False),
            sa.Column("credit_num", sa.BigInteger(), nullable=False),
            sa.Column("credit_denom", sa.BigInteger(), nullable=False),
            sa.Column("currency_guid", sa.String(length=36), sa.ForeignKey("commodities.id"), nullable=False),
            sa.Column("tax_override", sa.Boolean(), nullable=False),
            sa.Column("addr_name", sa.String(length=1024), nullable=True),
            sa.Column("addr_addr1", sa.String(length=1024), nullable=True),
            sa.Column("addr_addr2", sa.String(length=1024), nullable=True),
            sa.Column("addr_addr3", sa.String(length=1024), nullable=True),
            sa.Column("addr_addr4", sa.String(length=1024), nullable=True),
            sa.Column("addr_phone", sa.String(length=128), nullable=True),
            sa.Column("addr_fax", sa.String(length=128), nullable=True),
            sa.Column("addr_email", sa.String(length=256), nullable=True),
            sa.Column("shipaddr_name", sa.String(length=1024), nullable=True),
            sa.Column("shipaddr_addr1", sa.String(length=1024), nullable=True),
            sa.Column("shipaddr_addr2", sa.String(length=1024), nullable=True),
            sa.Column("shipaddr_addr3", sa.String(length=1024), nullable=True),
            sa.Column("shipaddr_addr4", sa.String(length=1024), nullable=True),
            sa.Column("shipaddr_phone", sa.String(length=128), nullable=True),
            sa.Column("shipaddr_fax", sa.String(length=128), nullable=True),
            sa.Column("shipaddr_email", sa.String(length=256), nullable=True),
            sa.Column("terms_guid", sa.String(length=36), nullable=True),
            sa.Column("tax_included", sa.Integer(), nullable=True),
            sa.Column("taxtable_guid", sa.String(length=36), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("discount_denom > 0", name="ck_customers_discount_denom_positive"),
            sa.CheckConstraint("credit_denom > 0", name="ck_customers_credit_denom_positive"),
        )
        inspector = sa.inspect(bind)

    if inspector.has_table("customers"):
        if not _index_exists(inspector, "customers", "ix_customers_book_id"):
            op.create_index("ix_customers_book_id", "customers", ["book_id"])
        if not _index_exists(inspector, "customers", "ix_customers_currency_guid"):
            op.create_index("ix_customers_currency_guid", "customers", ["currency_guid"])

    if not inspector.has_table("vendors"):
        op.create_table(
            "vendors",
            sa.Column("guid", sa.String(length=36), primary_key=True),
            sa.Column("book_id", sa.String(length=36), sa.ForeignKey("books.id"), nullable=False),
            sa.Column("name", sa.String(length=2048), nullable=False),
            sa.Column("id", sa.String(length=2048), nullable=False),
            sa.Column("notes", sa.String(length=2048), nullable=False),
            sa.Column("currency_guid", sa.String(length=36), sa.ForeignKey("commodities.id"), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=False),
            sa.Column("tax_override", sa.Boolean(), nullable=False),
            sa.Column("addr_name", sa.String(length=1024), nullable=True),
            sa.Column("addr_addr1", sa.String(length=1024), nullable=True),
            sa.Column("addr_addr2", sa.String(length=1024), nullable=True),
            sa.Column("addr_addr3", sa.String(length=1024), nullable=True),
            sa.Column("addr_addr4", sa.String(length=1024), nullable=True),
            sa.Column("addr_phone", sa.String(length=128), nullable=True),
            sa.Column("addr_fax", sa.String(length=128), nullable=True),
            sa.Column("addr_email", sa.String(length=256), nullable=True),
            sa.Column("terms_guid", sa.String(length=36), nullable=True),
            sa.Column("tax_inc", sa.String(length=2048), nullable=True),
            sa.Column("tax_table_guid", sa.String(length=36), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        inspector = sa.inspect(bind)

    if inspector.has_table("vendors"):
        if not _index_exists(inspector, "vendors", "ix_vendors_book_id"):
            op.create_index("ix_vendors_book_id", "vendors", ["book_id"])
        if not _index_exists(inspector, "vendors", "ix_vendors_currency_guid"):
            op.create_index("ix_vendors_currency_guid", "vendors", ["currency_guid"])


def downgrade() -> None:
    op.drop_index("ix_vendors_currency_guid", table_name="vendors")
    op.drop_index("ix_vendors_book_id", table_name="vendors")
    op.drop_table("vendors")

    op.drop_index("ix_customers_currency_guid", table_name="customers")
    op.drop_index("ix_customers_book_id", table_name="customers")
    op.drop_table("customers")
