"""reminder schema

Revision ID: 20260515_0003
Revises: 20260515_0002
Create Date: 2026-05-15
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260515_0003"
down_revision: str | None = "20260515_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "daily_task_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Integer(), nullable=False),
        sa.Column("default_remind_time", sa.String(length=5), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_daily_task_templates_user_id"), "daily_task_templates", ["user_id"], unique=False)

    op.create_table(
        "range_reminders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("display_mode", sa.String(length=32), nullable=False),
        sa.Column("remind_time", sa.String(length=5), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_range_reminders_end_date"), "range_reminders", ["end_date"], unique=False)
    op.create_index(op.f("ix_range_reminders_start_date"), "range_reminders", ["start_date"], unique=False)
    op.create_index(op.f("ix_range_reminders_user_id"), "range_reminders", ["user_id"], unique=False)

    op.create_table(
        "milestone_days",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("date_type", sa.String(length=16), nullable=False),
        sa.Column("calendar_type", sa.String(length=16), nullable=False, server_default="solar"),
        sa.Column("month", sa.Integer(), nullable=True),
        sa.Column("day", sa.Integer(), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("start_year", sa.Integer(), nullable=True),
        sa.Column("remind_days_before", sa.Integer(), nullable=False),
        sa.Column("show_countdown", sa.Integer(), nullable=False),
        sa.Column("show_after_due", sa.Integer(), nullable=False),
        sa.Column("completed", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_milestone_days_target_date"), "milestone_days", ["target_date"], unique=False)
    op.create_index(op.f("ix_milestone_days_user_id"), "milestone_days", ["user_id"], unique=False)

    op.create_table(
        "daily_task_status",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("task_date", sa.Date(), nullable=False),
        sa.Column("completed", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["template_id"], ["daily_task_templates.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_id", "task_date", name="uq_daily_task_status_template_date"),
    )
    op.create_index(op.f("ix_daily_task_status_task_date"), "daily_task_status", ["task_date"], unique=False)
    op.create_index(op.f("ix_daily_task_status_template_id"), "daily_task_status", ["template_id"], unique=False)
    op.create_index(op.f("ix_daily_task_status_user_id"), "daily_task_status", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_daily_task_status_user_id"), table_name="daily_task_status")
    op.drop_index(op.f("ix_daily_task_status_template_id"), table_name="daily_task_status")
    op.drop_index(op.f("ix_daily_task_status_task_date"), table_name="daily_task_status")
    op.drop_table("daily_task_status")
    op.drop_index(op.f("ix_milestone_days_user_id"), table_name="milestone_days")
    op.drop_index(op.f("ix_milestone_days_target_date"), table_name="milestone_days")
    op.drop_table("milestone_days")
    op.drop_index(op.f("ix_range_reminders_user_id"), table_name="range_reminders")
    op.drop_index(op.f("ix_range_reminders_start_date"), table_name="range_reminders")
    op.drop_index(op.f("ix_range_reminders_end_date"), table_name="range_reminders")
    op.drop_table("range_reminders")
    op.drop_index(op.f("ix_daily_task_templates_user_id"), table_name="daily_task_templates")
    op.drop_table("daily_task_templates")
