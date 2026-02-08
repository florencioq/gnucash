"""add ROOT account type

Revision ID: 062123514e26
Revises: 20260208_0001
Create Date: 2026-02-08 16:47:12.328613

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '062123514e26'
down_revision: Union[str, Sequence[str], None] = '20260208_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE accounttype ADD VALUE IF NOT EXISTS 'ROOT'")


def downgrade() -> None:
    # Postgres enums don't support removing values safely.
    pass
