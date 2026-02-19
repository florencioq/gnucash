"""add lots table for invoice posting

Revision ID: 20260216_0006
Revises: 20260216_0005
Create Date: 2026-02-16

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260216_0006"
down_revision: str | None = "20260216_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("lots"):
        op.create_table(
            "lots",
            sa.Column("guid", sa.String(length=36), primary_key=True),
            sa.Column("account_guid", sa.String(length=36), sa.ForeignKey("accounts.id"), nullable=False),
            sa.Column("is_closed", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        if bind.dialect.name != "sqlite":
            op.alter_column("lots", "is_closed", server_default=None)
        inspector = sa.inspect(bind)

    if inspector.has_table("lots") and not _index_exists(inspector, "lots", "ix_lots_account_guid"):
        op.create_index("ix_lots_account_guid", "lots", ["account_guid"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("lots"):
        if _index_exists(inspector, "lots", "ix_lots_account_guid"):
            op.drop_index("ix_lots_account_guid", table_name="lots")
        op.drop_table("lots")
