"""add fast lookup hash to auth sessions

Revision ID: 20260516_0008
Revises: 20260516_0007
Create Date: 2026-05-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260516_0008"
down_revision: Union[str, None] = "20260516_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("auth_sessions", sa.Column("token_lookup_hash", sa.String(length=64), nullable=True))
    op.create_index(op.f("ix_auth_sessions_token_lookup_hash"), "auth_sessions", ["token_lookup_hash"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_auth_sessions_token_lookup_hash"), table_name="auth_sessions")
    op.drop_column("auth_sessions", "token_lookup_hash")
