"""add account storage locations

Revision ID: 20260518_0010
Revises: 20260518_0009
Create Date: 2026-05-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260518_0010"
down_revision: Union[str, None] = "20260518_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("active_storage_id", sa.Integer(), nullable=True))
    op.create_table(
        "user_storages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("workspace_path", sa.String(length=1024), nullable=False),
        sa.Column("is_initialized", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_storages_user_id", "user_storages", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_storages_user_id", table_name="user_storages")
    op.drop_table("user_storages")
    op.drop_column("users", "active_storage_id")
