import json
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


TargetType = Literal["record", "journal_entry", "daily_task_template", "range_reminder", "milestone_day"]


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=24)
    description: str | None = Field(default=None, max_length=255)
    sort_order: int = 0


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=24)
    description: str | None = Field(default=None, max_length=255)
    sort_order: int | None = None
    archived: bool | None = None


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str | None
    description: str | None
    sort_order: int
    archived: bool
    created_at: datetime
    updated_at: datetime


class TagLinkRequest(BaseModel):
    target_type: TargetType
    target_id: int


class RecordTypeCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=80)
    icon: str | None = Field(default=None, max_length=64)
    color: str | None = Field(default=None, max_length=24)
    record_schema: dict[str, Any] = Field(default_factory=lambda: {"fields": []}, alias="schema")
    enabled: bool = True
    sort_order: int = 0


class RecordTypeUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=80)
    icon: str | None = Field(default=None, max_length=64)
    color: str | None = Field(default=None, max_length=24)
    record_schema: dict[str, Any] | None = Field(default=None, alias="schema")
    enabled: bool | None = None
    sort_order: int | None = None


class RecordTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    name: str
    icon: str | None
    color: str | None
    enabled: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
    record_schema: dict[str, Any] = Field(default_factory=dict, alias="schema")

    @classmethod
    def from_model(cls, item) -> "RecordTypeResponse":
        data = {
            "id": item.id,
            "name": item.name,
            "icon": item.icon,
            "color": item.color,
            "enabled": bool(item.enabled),
            "sort_order": item.sort_order,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "schema": json.loads(item.schema_json or "{}"),
        }
        return cls(**data)


class RecordCreate(BaseModel):
    record_type_id: int
    record_date: date
    occurred_at: datetime | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    note: str | None = None
    tag_ids: list[int] = Field(default_factory=list)


class RecordUpdate(BaseModel):
    record_type_id: int | None = None
    record_date: date | None = None
    occurred_at: datetime | None = None
    data: dict[str, Any] | None = None
    note: str | None = None
    tag_ids: list[int] | None = None


class RecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    record_type_id: int
    record_date: date
    occurred_at: datetime | None
    data_json: str
    note: str | None
    created_at: datetime
    updated_at: datetime
    data: dict[str, Any] = Field(default_factory=dict)
    tags: list[TagResponse] = Field(default_factory=list)

    @classmethod
    def from_model(cls, item, tags: list | None = None) -> "RecordResponse":
        data = cls.model_validate(item).model_dump()
        data["data"] = json.loads(item.data_json or "{}")
        data["tags"] = [TagResponse.model_validate(tag) for tag in tags or []]
        return cls(**data)


class JournalCreate(BaseModel):
    entry_date: date
    title: str = Field(min_length=1, max_length=160)
    markdown_content: str = ""
    summary: str | None = None
    tag_ids: list[int] = Field(default_factory=list)
    change_summary: str | None = Field(default="Create journal", max_length=255)


class JournalUpdate(BaseModel):
    entry_date: date | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    markdown_content: str | None = None
    summary: str | None = None
    tag_ids: list[int] | None = None
    change_summary: str | None = Field(default="Update journal", max_length=255)


class JournalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entry_date: date
    title: str
    markdown_content: str
    summary: str | None
    created_at: datetime
    updated_at: datetime
    tags: list[TagResponse] = Field(default_factory=list)

    @classmethod
    def from_model(cls, item, tags: list | None = None) -> "JournalResponse":
        data = cls.model_validate(item).model_dump()
        data["tags"] = [TagResponse.model_validate(tag) for tag in tags or []]
        return cls(**data)


class JournalVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    journal_entry_id: int
    version_no: int
    title: str
    markdown_content: str
    tag_snapshot_json: str
    change_summary: str | None
    created_at: datetime
    tag_snapshot: list[dict[str, Any]] = Field(default_factory=list)

    @classmethod
    def from_model(cls, item) -> "JournalVersionResponse":
        data = cls.model_validate(item).model_dump()
        data["tag_snapshot"] = json.loads(item.tag_snapshot_json or "[]")
        return cls(**data)


DailyTaskTimePeriod = Literal["morning", "noon", "afternoon", "evening", "night", "all_day"]


class DailyTaskTemplateCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = None
    enabled: bool = True
    time_period: DailyTaskTimePeriod = "all_day"
    default_remind_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    sort_order: int = 0
    tag_ids: list[int] = Field(default_factory=list)


class DailyTaskTemplateUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    enabled: bool | None = None
    time_period: DailyTaskTimePeriod | None = None
    default_remind_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    sort_order: int | None = None
    tag_ids: list[int] | None = None


class DailyTaskTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    enabled: bool
    time_period: DailyTaskTimePeriod
    default_remind_time: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime
    tags: list[TagResponse] = Field(default_factory=list)

    @classmethod
    def from_model(cls, item, tags: list | None = None) -> "DailyTaskTemplateResponse":
        data = cls.model_validate(item).model_dump()
        data["enabled"] = bool(item.enabled)
        data["tags"] = [TagResponse.model_validate(tag) for tag in tags or []]
        return cls(**data)


class DailyTaskStatusUpdate(BaseModel):
    completed: bool
    note: str | None = None


class DailyTaskItemResponse(BaseModel):
    template: DailyTaskTemplateResponse
    task_date: date
    completed: bool
    completed_at: datetime | None = None
    note: str | None = None


RangeReminderStatus = Literal["active", "completed", "cancelled"]
RangeDisplayMode = Literal["every_day", "start_only", "end_only", "start_and_end"]


class RangeTaskCategoryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    icon: str = Field(default="list", max_length=16)
    sort_order: int = 0


class RangeTaskCategoryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)
    icon: str | None = Field(default=None, max_length=16)
    sort_order: int | None = None


class RangeTaskCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    icon: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class RangeTaskStep(BaseModel):
    id: str | None = None
    title: str = Field(min_length=1, max_length=160)
    completed: bool = False


class RangeReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = None
    category_id: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: RangeReminderStatus = "active"
    display_mode: RangeDisplayMode = "every_day"
    remind_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    steps: list[RangeTaskStep] = Field(default_factory=list)
    tag_ids: list[int] = Field(default_factory=list)

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, value: date | None, info):
        start_date = info.data.get("start_date")
        if start_date and value and value < start_date:
            raise ValueError("end_date must be on or after start_date")
        return value


class RangeReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    category_id: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: RangeReminderStatus | None = None
    display_mode: RangeDisplayMode | None = None
    remind_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    steps: list[RangeTaskStep] | None = None
    tag_ids: list[int] | None = None


class RangeReminderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    category_id: int | None
    start_date: date
    end_date: date
    status: str
    display_mode: str
    remind_time: str | None
    steps: list[RangeTaskStep] = Field(default_factory=list)
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    tags: list[TagResponse] = Field(default_factory=list)

    @classmethod
    def from_model(cls, item, tags: list | None = None) -> "RangeReminderResponse":
        data = cls.model_validate(item).model_dump()
        data["steps"] = [RangeTaskStep.model_validate(step) for step in json.loads(item.steps_json or "[]")]
        data["tags"] = [TagResponse.model_validate(tag) for tag in tags or []]
        return cls(**data)


MilestoneDateType = Literal["weekly", "monthly", "yearly", "once"]
MilestoneCalendarType = Literal["solar", "lunar"]


class MilestoneDayCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    date_type: MilestoneDateType
    calendar_type: MilestoneCalendarType = "solar"
    month: int | None = Field(default=None, ge=1, le=12)
    day: int | None = Field(default=None, ge=1, le=31)
    target_date: date | None = None
    start_year: int | None = Field(default=None, ge=1, le=9999)
    remind_days_before: int = Field(default=0, ge=0, le=3660)
    show_countdown: bool = True
    show_after_due: bool = True
    completed: bool = False
    note: str | None = None
    color: str | None = Field(default=None, max_length=24)
    background_url: str | None = Field(default=None, max_length=512)
    enabled: bool = True
    tag_ids: list[int] = Field(default_factory=list)

    @field_validator("target_date")
    @classmethod
    def validate_once_target_date(cls, value: date | None, info):
        if info.data.get("date_type") == "once" and value is None:
            raise ValueError("target_date is required for once milestones")
        return value


class MilestoneDayUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    date_type: MilestoneDateType | None = None
    calendar_type: MilestoneCalendarType | None = None
    month: int | None = Field(default=None, ge=1, le=12)
    day: int | None = Field(default=None, ge=1, le=31)
    target_date: date | None = None
    start_year: int | None = Field(default=None, ge=1, le=9999)
    remind_days_before: int | None = Field(default=None, ge=0, le=3660)
    show_countdown: bool | None = None
    show_after_due: bool | None = None
    completed: bool | None = None
    note: str | None = None
    color: str | None = Field(default=None, max_length=24)
    background_url: str | None = Field(default=None, max_length=512)
    enabled: bool | None = None
    tag_ids: list[int] | None = None


class MilestoneDayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    date_type: str
    calendar_type: str = "solar"
    month: int | None
    day: int | None
    target_date: date | None
    start_year: int | None
    remind_days_before: int
    show_countdown: bool
    show_after_due: bool
    completed: bool
    completed_at: datetime | None
    note: str | None
    color: str | None = None
    enabled: bool
    background_url: str | None = None
    created_at: datetime
    updated_at: datetime
    occurrence_date: date | None = None
    countdown_days: int | None = None
    countdown_label: str | None = None
    anniversary_count: int | None = None
    tags: list[TagResponse] = Field(default_factory=list)

    @classmethod
    def from_model(
        cls,
        item,
        *,
        occurrence_date: date | None = None,
        countdown_days: int | None = None,
        countdown_label: str | None = None,
        anniversary_count: int | None = None,
        tags: list | None = None,
    ) -> "MilestoneDayResponse":
        data = cls.model_validate(item).model_dump()
        data["show_countdown"] = bool(item.show_countdown)
        data["show_after_due"] = bool(item.show_after_due)
        data["completed"] = bool(item.completed)
        data["enabled"] = bool(item.enabled)
        data["occurrence_date"] = occurrence_date
        data["countdown_days"] = countdown_days
        data["countdown_label"] = countdown_label
        data["anniversary_count"] = anniversary_count
        data["tags"] = [TagResponse.model_validate(tag) for tag in tags or []]
        return cls(**data)


class CalendarDayCounts(BaseModel):
    records: int = 0
    journals: int = 0
    daily_tasks: int = 0
    range_reminders: int = 0
    milestone_days: int = 0
    uncompleted_daily_tasks: int = 0


class CalendarItemSummary(BaseModel):
    id: int
    title: str
    color: str | None = None
    status: str | None = None


class CalendarDaySummary(BaseModel):
    date: date
    weekday_label: str = ""
    lunar_label: str = ""
    holidays: list[str] = Field(default_factory=list)
    counts: CalendarDayCounts
    tags: list[TagResponse] = Field(default_factory=list)
    range_reminders: list[CalendarItemSummary] = Field(default_factory=list)
    milestone_days: list[CalendarItemSummary] = Field(default_factory=list)
    has_uncompleted_tasks: bool = False


class CalendarMonthResponse(BaseModel):
    year: int
    month: int
    days: list[CalendarDaySummary]


class CalendarDayDetailResponse(BaseModel):
    date: date
    weekday_label: str = ""
    lunar_label: str = ""
    holidays: list[str] = Field(default_factory=list)
    records: list[RecordResponse] = Field(default_factory=list)
    journals: list[JournalResponse] = Field(default_factory=list)
    daily_tasks: list[DailyTaskItemResponse] = Field(default_factory=list)
    range_reminders: list[RangeReminderResponse] = Field(default_factory=list)
    milestone_days: list[MilestoneDayResponse] = Field(default_factory=list)
    tags: list[TagResponse] = Field(default_factory=list)


# ── 番茄钟 & 任务日志 ──

class TimerSessionCreate(BaseModel):
    task_type: str = Field(min_length=1, max_length=32)
    task_id: int
    planned_minutes: int = 25
    timer_mode: str = "countdown"


class TimerSessionUpdate(BaseModel):
    status: str | None = None
    actual_seconds: int | None = None


class TimerSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_type: str
    task_id: int
    started_at: datetime
    ended_at: datetime | None
    planned_minutes: int
    actual_seconds: int
    status: str
    timer_mode: str
    created_at: datetime
    updated_at: datetime


class WorkLogCreate(BaseModel):
    task_type: str = Field(min_length=1, max_length=32)
    task_id: int
    title: str | None = Field(default=None, max_length=160)
    content: str = Field(min_length=1)


class WorkLogUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    content: str | None = Field(default=None, min_length=1)


class WorkLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_type: str
    task_id: int
    title: str | None = None
    content: str
    created_at: datetime
    updated_at: datetime


class TaskTimeStats(BaseModel):
    task_id: int
    task_title: str
    task_type: str
    category_id: int | None = None
    category_title: str | None = None
    total_seconds: int = 0
    session_count: int = 0
    completed_count: int = 0  # 任务完成数量
    sub_tasks: list["TaskTimeStats"] = Field(default_factory=list)  # 子任务明细


class TaskCompletionStats(BaseModel):
    """任务完成统计"""
    task_id: int
    task_title: str
    task_type: str
    category_id: int | None = None
    category_title: str | None = None
    completed_count: int = 0
    total_count: int = 0


class TimeStatsResponse(BaseModel):
    period: str
    start_date: date
    end_date: date
    daily_tasks: list[TaskTimeStats] = Field(default_factory=list)
    range_reminders: list[TaskTimeStats] = Field(default_factory=list)
    range_categories: list[TaskTimeStats] = Field(default_factory=list)
    total_seconds: int = 0
    # 任务完成统计
    daily_completed: int = 0
    daily_total: int = 0
    range_completed: int = 0
    range_total: int = 0
    category_completions: list[TaskCompletionStats] = Field(default_factory=list)
    # 折线图趋势数据
    trend: list[dict] = Field(default_factory=list)
