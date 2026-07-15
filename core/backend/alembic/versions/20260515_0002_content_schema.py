"""content schema

Revision ID: 20260515_0002
Revises: 20260515_0001
Create Date: 2026-05-15
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260515_0002"
down_revision: str | None = "20260515_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("color", sa.String(length=24), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("archived", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_tags_user_name"),
    )
    op.create_index(op.f("ix_tags_user_id"), "tags", ["user_id"], unique=False)

    op.create_table(
        "record_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("icon", sa.String(length=64), nullable=True),
        sa.Column("color", sa.String(length=24), nullable=True),
        sa.Column("schema_json", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_record_types_user_name"),
    )
    op.create_index(op.f("ix_record_types_user_id"), "record_types", ["user_id"], unique=False)

    op.create_table(
        "journal_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("markdown_content", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_journal_entries_entry_date"), "journal_entries", ["entry_date"], unique=False)
    op.create_index(op.f("ix_journal_entries_user_id"), "journal_entries", ["user_id"], unique=False)

    op.create_table(
        "records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("record_type_id", sa.Integer(), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=True),
        sa.Column("data_json", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["record_type_id"], ["record_types.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_records_record_date"), "records", ["record_date"], unique=False)
    op.create_index(op.f("ix_records_record_type_id"), "records", ["record_type_id"], unique=False)
    op.create_index(op.f("ix_records_user_id"), "records", ["user_id"], unique=False)

    op.create_table(
        "tag_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.Column("target_type", sa.String(length=48), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "tag_id", "target_type", "target_id", name="uq_tag_links_target"),
    )
    op.create_index(op.f("ix_tag_links_tag_id"), "tag_links", ["tag_id"], unique=False)
    op.create_index(op.f("ix_tag_links_target_id"), "tag_links", ["target_id"], unique=False)
    op.create_index(op.f("ix_tag_links_target_type"), "tag_links", ["target_type"], unique=False)
    op.create_index(op.f("ix_tag_links_user_id"), "tag_links", ["user_id"], unique=False)

    op.create_table(
        "journal_entry_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("journal_entry_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("markdown_content", sa.Text(), nullable=False),
        sa.Column("tag_snapshot_json", sa.Text(), nullable=False),
        sa.Column("change_summary", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["journal_entry_id"], ["journal_entries.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("journal_entry_id", "version_no", name="uq_journal_versions_no"),
    )
    op.create_index(op.f("ix_journal_entry_versions_journal_entry_id"), "journal_entry_versions", ["journal_entry_id"], unique=False)
    op.create_index(op.f("ix_journal_entry_versions_user_id"), "journal_entry_versions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_journal_entry_versions_user_id"), table_name="journal_entry_versions")
    op.drop_index(op.f("ix_journal_entry_versions_journal_entry_id"), table_name="journal_entry_versions")
    op.drop_table("journal_entry_versions")
    op.drop_index(op.f("ix_tag_links_user_id"), table_name="tag_links")
    op.drop_index(op.f("ix_tag_links_target_type"), table_name="tag_links")
    op.drop_index(op.f("ix_tag_links_target_id"), table_name="tag_links")
    op.drop_index(op.f("ix_tag_links_tag_id"), table_name="tag_links")
    op.drop_table("tag_links")
    op.drop_index(op.f("ix_records_user_id"), table_name="records")
    op.drop_index(op.f("ix_records_record_type_id"), table_name="records")
    op.drop_index(op.f("ix_records_record_date"), table_name="records")
    op.drop_table("records")
    op.drop_index(op.f("ix_journal_entries_user_id"), table_name="journal_entries")
    op.drop_index(op.f("ix_journal_entries_entry_date"), table_name="journal_entries")
    op.drop_table("journal_entries")
    op.drop_index(op.f("ix_record_types_user_id"), table_name="record_types")
    op.drop_table("record_types")
    op.drop_index(op.f("ix_tags_user_id"), table_name="tags")
    op.drop_table("tags")
