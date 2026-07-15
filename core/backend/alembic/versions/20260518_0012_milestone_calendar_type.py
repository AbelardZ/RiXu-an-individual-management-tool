"""add calendar_type to milestone_days

Revision ID: 20260518_0012
Revises: 20260518_0011
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_0012"
down_revision = "20260518_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "milestone_days",
        sa.Column("calendar_type", sa.String(length=16), nullable=False, server_default="solar"),
    )


def downgrade() -> None:
    op.drop_column("milestone_days", "calendar_type")
