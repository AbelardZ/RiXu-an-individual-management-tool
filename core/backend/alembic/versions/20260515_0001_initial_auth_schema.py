"""initial auth schema

Revision ID: 20260515_0001
Revises:
Create Date: 2026-05-15
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260515_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
    )
    op.create_index(op.f("ix_auth_sessions_token_hash"), "auth_sessions", ["token_hash"], unique=False)
    op.create_index(op.f("ix_auth_sessions_user_id"), "auth_sessions", ["user_id"], unique=False)

    op.create_table(
        "invitation_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("assigned_email", sa.String(length=320), nullable=True),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("max_uses", sa.Integer(), nullable=False),
        sa.Column("used_count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("disabled_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invitation_codes_assigned_email"), "invitation_codes", ["assigned_email"], unique=False)
    op.create_index(op.f("ix_invitation_codes_code_hash"), "invitation_codes", ["code_hash"], unique=True)

    op.create_table(
        "invitation_uses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invitation_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("used_email", sa.String(length=320), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["invitation_id"], ["invitation_codes.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "user_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("nickname", sa.String(length=80), nullable=False),
        sa.Column("gender", sa.String(length=32), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.Column("birth_time", sa.String(length=5), nullable=False),
        sa.Column("birth_timezone", sa.String(length=64), nullable=False),
        sa.Column("birth_place", sa.String(length=160), nullable=True),
        sa.Column("bazi_status", sa.String(length=32), nullable=False),
        sa.Column("bazi_result_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_profiles")
    op.drop_table("invitation_uses")
    op.drop_index(op.f("ix_invitation_codes_code_hash"), table_name="invitation_codes")
    op.drop_index(op.f("ix_invitation_codes_assigned_email"), table_name="invitation_codes")
    op.drop_table("invitation_codes")
    op.drop_index(op.f("ix_auth_sessions_user_id"), table_name="auth_sessions")
    op.drop_index(op.f("ix_auth_sessions_token_hash"), table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
