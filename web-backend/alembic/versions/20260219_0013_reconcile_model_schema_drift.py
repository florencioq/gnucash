"""reconcile model/schema drift for indexes and constraints

Revision ID: 20260219_0013
Revises: 20260218_0012
Create Date: 2026-02-19

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260219_0013"
down_revision: str | None = "20260218_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def _check_exists(inspector: sa.Inspector, table_name: str, constraint_name: str) -> bool:
    return any(check["name"] == constraint_name for check in inspector.get_check_constraints(table_name))


def _fk_name_for_column(inspector: sa.Inspector, table_name: str, column_name: str) -> str | None:
    for fk in inspector.get_foreign_keys(table_name):
        columns = fk.get("constrained_columns") or []
        if len(columns) == 1 and columns[0] == column_name:
            return fk.get("name")
    return None


def _quote_ident(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("users") and not _index_exists(inspector, "users", "ix_users_email"):
        op.create_index("ix_users_email", "users", ["email"], unique=True)
        inspector = sa.inspect(bind)

    if inspector.has_table("entries") and not _check_exists(inspector, "entries", "ck_entries_tax_denom_positive"):
        if bind.dialect.name == "sqlite":
            pass
        else:
            op.create_check_constraint("ck_entries_tax_denom_positive", "entries", "i_tax_denom > 0")
        inspector = sa.inspect(bind)

    if bind.dialect.name == "postgresql" and inspector.has_table("books"):
        target_names = {
            "default_payables_account_guid": "fk_books_default_payables_account_guid",
            "default_receivables_account_guid": "fk_books_default_receivables_account_guid",
            "default_iss_recoverable_account_guid": "fk_books_default_iss_recoverable_account_guid",
        }
        for column_name, target_name in target_names.items():
            current_name = _fk_name_for_column(inspector, "books", column_name)
            if current_name and current_name != target_name:
                op.execute(
                    sa.text(
                        f"ALTER TABLE {_quote_ident('books')} "
                        f"RENAME CONSTRAINT {_quote_ident(current_name)} TO {_quote_ident(target_name)}"
                    )
                )
                inspector = sa.inspect(bind)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("entries") and _check_exists(inspector, "entries", "ck_entries_tax_denom_positive"):
        if bind.dialect.name == "sqlite":
            pass
        else:
            op.drop_constraint("ck_entries_tax_denom_positive", "entries", type_="check")
        inspector = sa.inspect(bind)

    if inspector.has_table("users") and _index_exists(inspector, "users", "ix_users_email"):
        op.drop_index("ix_users_email", table_name="users")

    # Constraint-name changes on books are intentionally not reversed.
