"""initial schema

Revision ID: 20260208_0001
Revises:
Create Date: 2026-02-08

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260208_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "books",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "commodities",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("namespace", sa.String(length=32), nullable=False),
        sa.Column("mnemonic", sa.String(length=16), nullable=False),
        sa.Column("fullname", sa.String(length=128), nullable=True),
        sa.Column("fraction", sa.Integer(), nullable=False),
        sa.Column("quote", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("namespace", "mnemonic", name="uq_commodity_namespace_mnemonic"),
    )
    op.create_index("ix_commodities_namespace", "commodities", ["namespace"])
    op.create_index("ix_commodities_mnemonic", "commodities", ["mnemonic"])

    account_type = postgresql.ENUM(
        "ASSET",
        "LIABILITY",
        "INCOME",
        "EXPENSE",
        "EQUITY",
        name="accounttype",
        create_type=False,
    )
    account_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "accounts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("book_id", sa.String(length=36), sa.ForeignKey("books.id"), nullable=False),
        sa.Column("parent_id", sa.String(length=36), sa.ForeignKey("accounts.id"), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("type", account_type, nullable=False),
        sa.Column("commodity_id", sa.String(length=36), sa.ForeignKey("commodities.id"), nullable=False),
        sa.Column("is_placeholder", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_accounts_book_id", "accounts", ["book_id"])
    op.create_index("ix_accounts_parent_id", "accounts", ["parent_id"])
    op.create_index("ix_accounts_name", "accounts", ["name"])
    op.create_index("ix_accounts_commodity_id", "accounts", ["commodity_id"])
    op.create_index("ix_accounts_book_parent_name", "accounts", ["book_id", "parent_id", "name"])


def downgrade() -> None:
    op.drop_index("ix_accounts_book_parent_name", table_name="accounts")
    op.drop_index("ix_accounts_commodity_id", table_name="accounts")
    op.drop_index("ix_accounts_name", table_name="accounts")
    op.drop_index("ix_accounts_parent_id", table_name="accounts")
    op.drop_index("ix_accounts_book_id", table_name="accounts")
    op.drop_table("accounts")

    op.drop_index("ix_commodities_mnemonic", table_name="commodities")
    op.drop_index("ix_commodities_namespace", table_name="commodities")
    op.drop_table("commodities")

    op.drop_table("books")

    postgresql.ENUM(name="accounttype").drop(op.get_bind(), checkfirst=True)
