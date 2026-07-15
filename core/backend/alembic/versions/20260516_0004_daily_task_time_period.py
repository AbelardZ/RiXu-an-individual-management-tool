"""daily task time period

Revision ID: 20260516_0004
Revises: 20260515_0003
Create Date: 2026-05-16
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260516_0004"
down_revision: str | None = "20260515_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "daily_task_templates",
        sa.Column("time_period", sa.String(length=16), nullable=False, server_default="all_day"),
    )


def downgrade() -> None:
    op.drop_column("daily_task_templates", "time_period")
