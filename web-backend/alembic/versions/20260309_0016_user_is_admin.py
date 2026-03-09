"""add is_admin column to users table

Revision ID: 20260309_0016
Revises: 20260225_0015
Create Date: 2026-03-09

"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260309_0016"
down_revision: str | None = "20260225_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}
    if "is_admin" not in columns:
        op.add_column(
            "users",
            sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}
    if "is_admin" in columns:
        op.drop_column("users", "is_admin")
