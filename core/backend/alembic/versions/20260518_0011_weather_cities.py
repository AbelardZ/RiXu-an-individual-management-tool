"""add weather_cities_json to user_profiles

Revision ID: 20260518_0011
Revises: 20260518_0010
Create Date: 2026-05-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260518_0011"
down_revision: Union[str, None] = "20260518_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_profiles", sa.Column("weather_cities_json", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_profiles", "weather_cities_json")
