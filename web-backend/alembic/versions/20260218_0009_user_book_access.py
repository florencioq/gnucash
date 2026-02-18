"""add user-book access roles

Revision ID: 20260218_0009
Revises: 20260218_0008
Create Date: 2026-02-18 12:45:00.000000

"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260218_0009"
down_revision: str | None = "20260218_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return inspector.has_table(table_name)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _table_exists(inspector, "user_book_access"):
        op.create_table(
            "user_book_access",
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("book_id", sa.String(length=36), nullable=False),
            sa.Column("role", sa.String(length=6), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id", "book_id"),
            sa.CheckConstraint("role in ('VIEWER','EDITOR')", name="ck_user_book_access_role"),
        )
        op.create_index("ix_user_book_access_book_id", "user_book_access", ["book_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _table_exists(inspector, "user_book_access"):
        op.drop_index("ix_user_book_access_book_id", table_name="user_book_access")
        op.drop_table("user_book_access")
