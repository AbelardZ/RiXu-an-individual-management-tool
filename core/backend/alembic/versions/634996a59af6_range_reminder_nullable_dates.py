"""range_reminder_nullable_dates

Revision ID: 634996a59af6
Revises: 20260518_0012
Create Date: 2026-07-15 14:22:50.619935
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa



revision: str = '634996a59af6'
down_revision: str | None = '20260518_0012'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # SQLite doesn't support ALTER COLUMN ... DROP NOT NULL, use batch mode
    with op.batch_alter_table('range_reminders') as batch_op:
        batch_op.alter_column('start_date', existing_type=sa.DATE(), nullable=True)
        batch_op.alter_column('end_date', existing_type=sa.DATE(), nullable=True)
        batch_op.create_index(op.f('ix_range_reminders_category_id'), ['category_id'], unique=False)
        batch_op.create_foreign_key('fk_range_reminders_category_id', 'range_task_categories', ['category_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('range_reminders') as batch_op:
        batch_op.drop_constraint('fk_range_reminders_category_id', type_='foreignkey')
        batch_op.drop_index(op.f('ix_range_reminders_category_id'))
        batch_op.alter_column('end_date', existing_type=sa.DATE(), nullable=False)
        batch_op.alter_column('start_date', existing_type=sa.DATE(), nullable=False)
