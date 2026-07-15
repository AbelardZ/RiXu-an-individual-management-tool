"""add attachments table

Revision ID: 20260518_0009
Revises: 20260516_0008
Create Date: 2026-05-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260518_0009"
down_revision: Union[str, None] = "20260516_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_type", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=True),
        sa.Column("size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attachments_owner_type", "attachments", ["owner_type"])
    op.create_index("ix_attachments_owner_id", "attachments", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_attachments_owner_id", table_name="attachments")
    op.drop_index("ix_attachments_owner_type", table_name="attachments")
    op.drop_table("attachments")
