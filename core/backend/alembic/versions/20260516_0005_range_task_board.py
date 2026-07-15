"""range task board fields

Revision ID: 20260516_0005
Revises: 20260516_0004
Create Date: 2026-05-16
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260516_0005"
down_revision: str | None = "20260516_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "range_task_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("icon", sa.String(length=16), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_range_task_categories_user_id"), "range_task_categories", ["user_id"], unique=False)
    op.add_column("range_reminders", sa.Column("category_id", sa.Integer(), nullable=True))
    op.add_column("range_reminders", sa.Column("steps_json", sa.Text(), nullable=False, server_default="[]"))
    op.add_column("range_reminders", sa.Column("completed_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_range_reminders_category_id"), "range_reminders", ["category_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_range_reminders_category_id"), table_name="range_reminders")
    op.drop_column("range_reminders", "completed_at")
    op.drop_column("range_reminders", "steps_json")
    op.drop_column("range_reminders", "category_id")
    op.drop_index(op.f("ix_range_task_categories_user_id"), table_name="range_task_categories")
    op.drop_table("range_task_categories")
