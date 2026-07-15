"""add avatar_url and signature to user_profiles

Revision ID: 20260516_0006
Revises: 20260516_0005
Create Date: 2026-05-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260516_0006"
down_revision: Union[str, None] = "20260516_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_profiles", sa.Column("avatar_url", sa.String(512), nullable=True))
    op.add_column("user_profiles", sa.Column("signature", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("user_profiles", "signature")
    op.drop_column("user_profiles", "avatar_url")
