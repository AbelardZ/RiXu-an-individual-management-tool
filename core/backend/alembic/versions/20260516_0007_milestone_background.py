"""add background_url to milestone_days

Revision ID: 20260516_0007
Revises: 20260516_0006
Create Date: 2026-05-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260516_0007"
down_revision: Union[str, None] = "20260516_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("milestone_days", sa.Column("background_url", sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column("milestone_days", "background_url")
