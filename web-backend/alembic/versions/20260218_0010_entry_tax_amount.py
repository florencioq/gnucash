"""add explicit tax amount fields to invoice/bill entries

Revision ID: 20260218_0010
Revises: 20260218_0009
Create Date: 2026-02-18 15:30:00.000000

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260218_0010"
down_revision: str | None = "20260218_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("entries"):
        return

    if not _column_exists(inspector, "entries", "i_tax_num"):
        op.add_column(
            "entries",
            sa.Column("i_tax_num", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        )
        inspector = sa.inspect(bind)

    if not _column_exists(inspector, "entries", "i_tax_denom"):
        op.add_column(
            "entries",
            sa.Column("i_tax_denom", sa.BigInteger(), nullable=False, server_default=sa.text("1")),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("entries"):
        return

    if _column_exists(inspector, "entries", "i_tax_denom"):
        op.drop_column("entries", "i_tax_denom")
        inspector = sa.inspect(bind)

    if _column_exists(inspector, "entries", "i_tax_num"):
        op.drop_column("entries", "i_tax_num")
