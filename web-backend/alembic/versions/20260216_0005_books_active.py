"""add active book flag

Revision ID: 20260216_0005
Revises: 20260216_0004
Create Date: 2026-02-16

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260216_0005"
down_revision: str | None = "20260216_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("books"):
        return

    if not _column_exists(inspector, "books", "is_active"):
        op.add_column(
            "books",
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.alter_column("books", "is_active", server_default=None)
        inspector = sa.inspect(bind)

    books_table = sa.table(
        "books",
        sa.column("id", sa.String(length=36)),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("is_active", sa.Boolean()),
    )

    active_id = bind.execute(
        sa.select(books_table.c.id)
        .where(books_table.c.is_active.is_(True))
        .order_by(books_table.c.created_at.asc(), books_table.c.id.asc())
        .limit(1)
    ).scalar_one_or_none()
    if active_id is None:
        fallback_id = bind.execute(
            sa.select(books_table.c.id)
            .order_by(books_table.c.created_at.asc(), books_table.c.id.asc())
            .limit(1)
        ).scalar_one_or_none()
        if fallback_id is not None:
            bind.execute(sa.update(books_table).values(is_active=False))
            bind.execute(sa.update(books_table).where(books_table.c.id == fallback_id).values(is_active=True))
    else:
        bind.execute(sa.update(books_table).where(books_table.c.id != active_id).values(is_active=False))

    inspector = sa.inspect(bind)
    if not _index_exists(inspector, "books", "ix_books_is_active"):
        op.create_index("ix_books_is_active", "books", ["is_active"], unique=False)

    if not _index_exists(inspector, "books", "ux_books_single_active"):
        op.create_index(
            "ux_books_single_active",
            "books",
            ["is_active"],
            unique=True,
            sqlite_where=sa.text("is_active = 1"),
            postgresql_where=sa.text("is_active = true"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("books"):
        return

    if _index_exists(inspector, "books", "ux_books_single_active"):
        op.drop_index("ux_books_single_active", table_name="books")
    if _index_exists(inspector, "books", "ix_books_is_active"):
        op.drop_index("ix_books_is_active", table_name="books")

    inspector = sa.inspect(bind)
    if _column_exists(inspector, "books", "is_active"):
        op.drop_column("books", "is_active")
