"""initial tables: books, commodities, accounts

Revision ID: 20260115_0001
Revises: 
Create Date: 2026-01-15
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260115_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "books",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "commodities",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("namespace", sa.String(length=32), nullable=False),
        sa.Column("mnemonic", sa.String(length=16), nullable=False),
        sa.Column("fullname", sa.String(length=128), nullable=True),
        sa.Column("fraction", sa.Integer(), nullable=False),
        sa.Column("quote", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("namespace", "mnemonic", name="uq_commodity_namespace_mnemonic"),
    )
    op.create_index("ix_commodities_namespace", "commodities", ["namespace"]) 
    op.create_index("ix_commodities_mnemonic", "commodities", ["mnemonic"]) 

    op.create_table(
        "accounts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("book_id", sa.String(length=36), sa.ForeignKey("books.id"), nullable=False),
        sa.Column("parent_id", sa.String(length=36), sa.ForeignKey("accounts.id"), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("type", sa.Enum("ASSET", "LIABILITY", "INCOME", "EXPENSE", "EQUITY", name="accounttype"), nullable=False),
        sa.Column("commodity_id", sa.String(length=36), sa.ForeignKey("commodities.id"), nullable=False),
        sa.Column("is_placeholder", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_accounts_book_parent_name", "accounts", ["book_id", "parent_id", "name"]) 


def downgrade():
    op.drop_index("ix_accounts_book_parent_name", table_name="accounts")
    op.drop_table("accounts")
    op.drop_index("ix_commodities_mnemonic", table_name="commodities")
    op.drop_index("ix_commodities_namespace", table_name="commodities")
    op.drop_table("commodities")
    op.drop_table("books")
