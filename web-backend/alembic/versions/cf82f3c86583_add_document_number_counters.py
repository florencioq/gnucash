"""add document number counters

Revision ID: cf82f3c86583
Revises: 20260216_0007
Create Date: 2026-02-18 10:39:23.905636

"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "cf82f3c86583"
down_revision: str | None = "20260216_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return inspector.has_table(table_name)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _table_exists(inspector, "document_number_counters"):
        op.create_table(
            "document_number_counters",
            sa.Column(
                "book_id",
                sa.String(length=36),
                sa.ForeignKey("books.id", ondelete="CASCADE"),
                primary_key=True,
                nullable=False,
            ),
            sa.Column("owner_type", sa.String(length=32), primary_key=True, nullable=False),
            sa.Column("next_value", sa.Integer(), nullable=False),
            sa.Column("width", sa.Integer(), nullable=False),
            sa.CheckConstraint("next_value >= 1", name="ck_document_number_counters_next_value_positive"),
            sa.CheckConstraint("width >= 1", name="ck_document_number_counters_width_positive"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _table_exists(inspector, "document_number_counters"):
        op.drop_table("document_number_counters")
