from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.security import utcnow


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tags_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    color: Mapped[str | None] = mapped_column(String(24))
    description: Mapped[str | None] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    archived: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


class TagLink(Base):
    __tablename__ = "tag_links"
    __table_args__ = (UniqueConstraint("user_id", "tag_id", "target_type", "target_id", name="uq_tag_links_target"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(128))
    size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class RecordType(Base):
    __tablename__ = "record_types"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_record_types_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(64))
    color: Mapped[str | None] = mapped_column(String(24))
    schema_json: Mapped[str] = mapped_column(Text, default='{"fields":[]}', nullable=False)
    enabled: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


class Record(Base):
    __tablename__ = "records"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    record_type_id: Mapped[int] = mapped_column(ForeignKey("record_types.id"), nullable=False, index=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime)
    data_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    markdown_content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


class JournalEntryVersion(Base):
    __tablename__ = "journal_entry_versions"
    __table_args__ = (UniqueConstraint("journal_entry_id", "version_no", name="uq_journal_versions_no"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    journal_entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    markdown_content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    tag_snapshot_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    change_summary: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class DailyTaskTemplate(Base):
    __tablename__ = "daily_task_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    enabled: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    time_period: Mapped[str] = mapped_column(String(16), default="all_day", nullable=False)
    default_remind_time: Mapped[str | None] = mapped_column(String(5))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


class DailyTaskStatus(Base):
    __tablename__ = "daily_task_status"
    __table_args__ = (UniqueConstraint("template_id", "task_date", name="uq_daily_task_status_template_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("daily_task_templates.id"), nullable=False, index=True)
    task_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


class RangeTaskCategory(Base):
    __tablename__ = "range_task_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    icon: Mapped[str] = mapped_column(String(16), default="list", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


class RangeReminder(Base):
    __tablename__ = "range_reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("range_task_categories.id"), index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    display_mode: Mapped[str] = mapped_column(String(32), default="every_day", nullable=False)
    remind_time: Mapped[str | None] = mapped_column(String(5))
    steps_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


class MilestoneDay(Base):
    __tablename__ = "milestone_days"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    date_type: Mapped[str] = mapped_column(String(16), nullable=False)
    calendar_type: Mapped[str] = mapped_column(String(16), default="solar", nullable=False)
    month: Mapped[int | None] = mapped_column(Integer)
    day: Mapped[int | None] = mapped_column(Integer)
    target_date: Mapped[date | None] = mapped_column(Date, index=True)
    start_year: Mapped[int | None] = mapped_column(Integer)
    remind_days_before: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    show_countdown: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    show_after_due: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    note: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(String(24))
    background_url: Mapped[str | None] = mapped_column(String(512))
    enabled: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)


# ── 番茄钟 & 任务日志 ──

class TaskTimerSession(Base):
    """番茄钟计时会话"""
    __tablename__ = "task_timer_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    task_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)  # 'daily_task' | 'range_reminder'
    task_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)
    planned_minutes: Mapped[int] = mapped_column(Integer, default=25, nullable=False)  # 计划时长（分钟）
    actual_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 实际计时（秒）
    status: Mapped[str] = mapped_column(String(16), default="running", nullable=False)  # 'running' | 'paused' | 'completed' | 'cancelled'
    timer_mode: Mapped[str] = mapped_column(String(16), default="countdown", nullable=False)  # 'countdown' | 'countup'
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class TaskWorkLog(Base):
    """任务工作日志（文字日志）"""
    __tablename__ = "task_work_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    task_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    task_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(160))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
