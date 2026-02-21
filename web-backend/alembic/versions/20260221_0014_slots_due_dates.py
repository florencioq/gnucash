"""add slots table for transaction due dates

Revision ID: 20260221_0014
Revises: 20260219_0013
Create Date: 2026-02-21

"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260221_0014"
down_revision: str | None = "20260219_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("slots"):
        op.create_table(
            "slots",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("obj_guid", sa.String(length=36), sa.ForeignKey("transactions.guid", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(length=4096), nullable=False),
            sa.Column("slot_type", sa.Integer(), nullable=False, server_default="10"),
            sa.Column("int64_val", sa.BigInteger(), nullable=True),
            sa.Column("string_val", sa.String(length=4096), nullable=True),
            sa.Column("timespec_val", sa.DateTime(timezone=True), nullable=True),
        )
        inspector = sa.inspect(bind)

    if inspector.has_table("slots"):
        if not _index_exists(inspector, "slots", "ix_slots_obj_guid"):
            op.create_index("ix_slots_obj_guid", "slots", ["obj_guid"])
        if not _index_exists(inspector, "slots", "ix_slots_name"):
            op.create_index("ix_slots_name", "slots", ["name"])
        if not _index_exists(inspector, "slots", "ix_slots_obj_guid_name"):
            op.create_index("ix_slots_obj_guid_name", "slots", ["obj_guid", "name"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("slots"):
        if _index_exists(inspector, "slots", "ix_slots_obj_guid_name"):
            op.drop_index("ix_slots_obj_guid_name", table_name="slots")
        if _index_exists(inspector, "slots", "ix_slots_name"):
            op.drop_index("ix_slots_name", table_name="slots")
        if _index_exists(inspector, "slots", "ix_slots_obj_guid"):
            op.drop_index("ix_slots_obj_guid", table_name="slots")
        op.drop_table("slots")
