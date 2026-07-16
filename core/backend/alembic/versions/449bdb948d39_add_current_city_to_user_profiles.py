"""add current_city to user_profiles

Revision ID: 449bdb948d39
Revises: 2da31d70a0ae
Create Date: 2026-07-16 11:30:41.715653
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa



revision: str = '449bdb948d39'
down_revision: str | None = '2da31d70a0ae'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('user_profiles', sa.Column('current_city', sa.String(160), nullable=True))


def downgrade() -> None:
    op.drop_column('user_profiles', 'current_city')
