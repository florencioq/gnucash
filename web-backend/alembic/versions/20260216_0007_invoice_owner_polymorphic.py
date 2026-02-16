"""allow invoice owner_guid for customers and vendors

Revision ID: 20260216_0007
Revises: 20260216_0006
Create Date: 2026-02-16

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260216_0007"
down_revision: str | None = "20260216_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _owner_guid_fk_names(inspector: sa.Inspector) -> list[str]:
    names: list[str] = []
    for foreign_key in inspector.get_foreign_keys("invoices"):
        columns = foreign_key.get("constrained_columns") or []
        name = foreign_key.get("name")
        if columns == ["owner_guid"] and name:
            names.append(name)
    return names


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("invoices"):
        return

    if bind.dialect.name == "sqlite":
        return

    for constraint_name in _owner_guid_fk_names(inspector):
        op.drop_constraint(constraint_name, "invoices", type_="foreignkey")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("invoices"):
        return

    if bind.dialect.name == "sqlite":
        return

    if _owner_guid_fk_names(inspector):
        return

    op.create_foreign_key(
        "fk_invoices_owner_guid_customers",
        "invoices",
        "customers",
        ["owner_guid"],
        ["guid"],
    )
