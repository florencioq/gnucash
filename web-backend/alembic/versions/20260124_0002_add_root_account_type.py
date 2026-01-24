"""add ROOT account type

Revision ID: 20260124_0002
Revises: 20260115_0001
Create Date: 2026-01-24
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260124_0002"
down_revision = "20260115_0001"
branch_labels = None
depends_on = None


def upgrade():
    # Add ROOT to the accounttype enum
    op.execute("ALTER TYPE accounttype ADD VALUE IF NOT EXISTS 'ROOT'")


def downgrade():
    # Note: PostgreSQL doesn't support removing enum values directly
    # This would require recreating the enum type, which is complex
    # For now, we'll leave ROOT in the enum even on downgrade
    pass
