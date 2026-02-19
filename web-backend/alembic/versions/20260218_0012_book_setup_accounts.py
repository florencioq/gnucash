"""add default setup accounts to books

Revision ID: 20260218_0012
Revises: 20260218_0011
Create Date: 2026-02-18 18:35:00.000000

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260218_0012"
down_revision: str | None = "20260218_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def _account_guid_column(bind: sa.Connection, column_name: str) -> sa.Column:
    if bind.dialect.name == "sqlite":
        return sa.Column(column_name, sa.String(length=36), nullable=True)
    return sa.Column(
        column_name,
        sa.String(length=36),
        sa.ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("books"):
        return

    if not _column_exists(inspector, "books", "default_payables_account_guid"):
        op.add_column(
            "books",
            _account_guid_column(bind, "default_payables_account_guid"),
        )
        inspector = sa.inspect(bind)

    if not _index_exists(inspector, "books", "ix_books_default_payables_account_guid"):
        op.create_index("ix_books_default_payables_account_guid", "books", ["default_payables_account_guid"])

    if not _column_exists(inspector, "books", "default_receivables_account_guid"):
        op.add_column(
            "books",
            _account_guid_column(bind, "default_receivables_account_guid"),
        )
        inspector = sa.inspect(bind)

    if not _index_exists(inspector, "books", "ix_books_default_receivables_account_guid"):
        op.create_index("ix_books_default_receivables_account_guid", "books", ["default_receivables_account_guid"])

    if not _column_exists(inspector, "books", "default_iss_recoverable_account_guid"):
        op.add_column(
            "books",
            _account_guid_column(bind, "default_iss_recoverable_account_guid"),
        )
        inspector = sa.inspect(bind)

    if not _index_exists(inspector, "books", "ix_books_default_iss_recoverable_account_guid"):
        op.create_index(
            "ix_books_default_iss_recoverable_account_guid",
            "books",
            ["default_iss_recoverable_account_guid"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("books"):
        return

    if _index_exists(inspector, "books", "ix_books_default_iss_recoverable_account_guid"):
        op.drop_index("ix_books_default_iss_recoverable_account_guid", table_name="books")
        inspector = sa.inspect(bind)
    if _column_exists(inspector, "books", "default_iss_recoverable_account_guid"):
        op.drop_column("books", "default_iss_recoverable_account_guid")
        inspector = sa.inspect(bind)

    if _index_exists(inspector, "books", "ix_books_default_receivables_account_guid"):
        op.drop_index("ix_books_default_receivables_account_guid", table_name="books")
        inspector = sa.inspect(bind)
    if _column_exists(inspector, "books", "default_receivables_account_guid"):
        op.drop_column("books", "default_receivables_account_guid")
        inspector = sa.inspect(bind)

    if _index_exists(inspector, "books", "ix_books_default_payables_account_guid"):
        op.drop_index("ix_books_default_payables_account_guid", table_name="books")
        inspector = sa.inspect(bind)
    if _column_exists(inspector, "books", "default_payables_account_guid"):
        op.drop_column("books", "default_payables_account_guid")
