from calendar import monthrange
from datetime import date

from fastapi import APIRouter, Depends, Query
from lunar_python import Solar
from sqlalchemy.orm import Session

from app.api.deps import get_content_db, get_current_user
from app.models.auth import User
from app.schemas.content import (
    CalendarDayCounts,
    CalendarDayDetailResponse,
    CalendarDaySummary,
    CalendarItemSummary,
    CalendarMonthResponse,
    DailyTaskItemResponse,
    DailyTaskTemplateResponse,
    JournalResponse,
    MilestoneDayResponse,
    RangeReminderResponse,
    RecordResponse,
    TagResponse,
)
from app.services.content import (
    list_daily_tasks_for_date,
    list_journals,
    list_milestone_days,
    list_range_reminders,
    list_records,
    list_target_tags,
    milestone_view_data,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])

WEEKDAY_LABELS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]


def _calendar_meta(day: date) -> tuple[str, str, list[str]]:
    solar = Solar.fromYmd(day.year, day.month, day.day)
    lunar = solar.getLunar()
    lunar_day = lunar.getDay()
    lunar_month = lunar.getMonth()
    
    # 节气优先显示
    jie_qi = lunar.getJieQi() or ""
    if jie_qi:
        lunar_label = jie_qi
    elif lunar_day == 1:
        # 初一显示月份
        lunar_label = f"{lunar.getMonthInChinese()}月"
    else:
        # 其他日期只显示日子
        lunar_label = lunar.getDayInChinese()
    
    holidays = [name for name in [*solar.getFestivals(), *lunar.getFestivals()] if name]
    return WEEKDAY_LABELS[day.weekday()], lunar_label, holidays


def _type_enabled(types: set[str], *names: str) -> bool:
    if not types or "all" in types:
        return True
    if "reminders" in types and any(name in {"daily_tasks", "range_reminders", "milestone_days"} for name in names):
        return True
    return any(name in types for name in names)


def _tag_map(tags: list) -> dict[int, TagResponse]:
    return {tag.id: TagResponse.model_validate(tag) for tag in tags}


def _merge_tags(target: dict[int, TagResponse], tags: list) -> None:
    target.update(_tag_map(tags))


def _tag_responses(tags: dict[int, TagResponse]) -> list[TagResponse]:
    return sorted(tags.values(), key=lambda item: (item.sort_order, item.name))


def _template_response(db: Session, user: User, template) -> DailyTaskTemplateResponse:
    return DailyTaskTemplateResponse.from_model(template, list_target_tags(db, user, "daily_task_template", template.id))


def _daily_task_items(
    db: Session,
    user: User,
    day: date,
    *,
    tag_id: int | None,
    completion_status: str | None,
) -> list[DailyTaskItemResponse]:
    items: list[DailyTaskItemResponse] = []
    for template, status in list_daily_tasks_for_date(db, user, day):
        tags = list_target_tags(db, user, "daily_task_template", template.id)
        completed = bool(status.completed) if status else False
        if tag_id and tag_id not in {tag.id for tag in tags}:
            continue
        if completion_status == "completed" and not completed:
            continue
        if completion_status == "uncompleted" and completed:
            continue
        items.append(
            DailyTaskItemResponse(
                template=DailyTaskTemplateResponse.from_model(template, tags),
                task_date=day,
                completed=completed,
                completed_at=status.completed_at if status else None,
                note=status.note if status else None,
            )
        )
    return items


def _milestone_response(db: Session, user: User, item, reference_date: date) -> MilestoneDayResponse:
    occurrence, countdown_days, label, anniversary = milestone_view_data(item, reference_date)
    return MilestoneDayResponse.from_model(
        item,
        occurrence_date=occurrence,
        countdown_days=countdown_days,
        countdown_label=label,
        anniversary_count=anniversary,
        tags=list_target_tags(db, user, "milestone_day", item.id),
    )


def _important_dates_for_day(db: Session, user: User, day: date, tag_id: int | None = None):
    items = []
    for date_type in ("weekly", "monthly", "yearly"):
        items.extend(list_milestone_days(db, user, reference_date=day, date_value=day, date_type=date_type, tag_id=tag_id))
    return items


def _normalized_types(types: list[str] | None) -> set[str]:
    return {item.strip() for item in types or [] if item.strip()}


@router.get("/month", response_model=CalendarMonthResponse)
def get_calendar_month(
    year: int = Query(ge=1, le=9999),
    month: int = Query(ge=1, le=12),
    types: list[str] | None = Query(default=None),
    record_type_id: int | None = None,
    reminder_type: str | None = None,
    tag_id: int | None = None,
    completion_status: str | None = Query(default=None, pattern="^(completed|uncompleted)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> CalendarMonthResponse:
    enabled_types = _normalized_types(types)
    day_count = monthrange(year, month)[1]
    days: list[CalendarDaySummary] = []

    for day_no in range(1, day_count + 1):
        day = date(year, month, day_no)
        tags: dict[int, TagResponse] = {}
        counts = CalendarDayCounts()
        range_summaries: list[CalendarItemSummary] = []
        milestone_summaries: list[CalendarItemSummary] = []

        if _type_enabled(enabled_types, "records"):
            records = list_records(db, current_user, date_value=day, record_type_id=record_type_id, tag_id=tag_id)
            counts.records = len(records)
            for record in records:
                _merge_tags(tags, list_target_tags(db, current_user, "record", record.id))

        if _type_enabled(enabled_types, "journals"):
            journals = list_journals(db, current_user, date_value=day, tag_id=tag_id)
            counts.journals = len(journals)
            for journal in journals:
                _merge_tags(tags, list_target_tags(db, current_user, "journal_entry", journal.id))

        if _type_enabled(enabled_types, "range_reminders") and (reminder_type in {None, "range_reminders", "range_reminder"}):
            ranges = list_range_reminders(db, current_user, date_value=day, tag_id=tag_id)
            counts.range_reminders = len(ranges)
            for item in ranges:
                range_summaries.append(CalendarItemSummary(id=item.id, title=item.title, status=item.status))
                _merge_tags(tags, list_target_tags(db, current_user, "range_reminder", item.id))

        if _type_enabled(enabled_types, "milestone_days") and (reminder_type in {None, "milestone_days", "milestone_day"}):
            milestones = _important_dates_for_day(db, current_user, day, tag_id)
            counts.milestone_days = len(milestones)
            for item in milestones:
                milestone_summaries.append(CalendarItemSummary(id=item.id, title=item.title, color=item.color))
                _merge_tags(tags, list_target_tags(db, current_user, "milestone_day", item.id))

        weekday_label, lunar_label, holidays = _calendar_meta(day)
        days.append(
            CalendarDaySummary(
                date=day,
                weekday_label=weekday_label,
                lunar_label=lunar_label,
                holidays=holidays,
                counts=counts,
                tags=_tag_responses(tags),
                range_reminders=range_summaries,
                milestone_days=milestone_summaries,
                has_uncompleted_tasks=False,
            )
        )

    return CalendarMonthResponse(year=year, month=month, days=days)


@router.get("/day/{day}", response_model=CalendarDayDetailResponse)
def get_calendar_day(
    day: date,
    types: list[str] | None = Query(default=None),
    record_type_id: int | None = None,
    reminder_type: str | None = None,
    tag_id: int | None = None,
    completion_status: str | None = Query(default=None, pattern="^(completed|uncompleted)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> CalendarDayDetailResponse:
    enabled_types = _normalized_types(types)
    tags: dict[int, TagResponse] = {}

    record_items: list[RecordResponse] = []
    journal_items: list[JournalResponse] = []
    daily_items: list[DailyTaskItemResponse] = []
    range_items: list[RangeReminderResponse] = []
    milestone_items: list[MilestoneDayResponse] = []

    if _type_enabled(enabled_types, "records"):
        for record in list_records(db, current_user, date_value=day, record_type_id=record_type_id, tag_id=tag_id):
            item_tags = list_target_tags(db, current_user, "record", record.id)
            _merge_tags(tags, item_tags)
            record_items.append(RecordResponse.from_model(record, item_tags))

    if _type_enabled(enabled_types, "journals"):
        for journal in list_journals(db, current_user, date_value=day, tag_id=tag_id):
            item_tags = list_target_tags(db, current_user, "journal_entry", journal.id)
            _merge_tags(tags, item_tags)
            journal_items.append(JournalResponse.from_model(journal, item_tags))

    if _type_enabled(enabled_types, "daily_tasks") and (reminder_type in {None, "daily_tasks", "daily_task"}):
        daily_items = _daily_task_items(db, current_user, day, tag_id=tag_id, completion_status=completion_status)
        for item in daily_items:
            for tag in item.template.tags:
                tags[tag.id] = tag

    if _type_enabled(enabled_types, "range_reminders") and (reminder_type in {None, "range_reminders", "range_reminder"}):
        for reminder in list_range_reminders(db, current_user, date_value=day, tag_id=tag_id):
            item_tags = list_target_tags(db, current_user, "range_reminder", reminder.id)
            _merge_tags(tags, item_tags)
            range_items.append(RangeReminderResponse.from_model(reminder, item_tags))

    if _type_enabled(enabled_types, "milestone_days") and (reminder_type in {None, "milestone_days", "milestone_day"}):
        for milestone in _important_dates_for_day(db, current_user, day, tag_id):
            item_tags = list_target_tags(db, current_user, "milestone_day", milestone.id)
            _merge_tags(tags, item_tags)
            milestone_items.append(_milestone_response(db, current_user, milestone, day))

    weekday_label, lunar_label, holidays = _calendar_meta(day)
    return CalendarDayDetailResponse(
        date=day,
        weekday_label=weekday_label,
        lunar_label=lunar_label,
        holidays=holidays,
        records=record_items,
        journals=journal_items,
        daily_tasks=daily_items,
        range_reminders=range_items,
        milestone_days=milestone_items,
        tags=_tag_responses(tags),
    )


@router.get("/now-stems-branches")
def get_now_stems_branches() -> dict:
    """获取当前时刻的天干地支（年、月、日、时柱）+ 择日信息"""
    from datetime import datetime

    now = datetime.now()
    solar = Solar.fromYmdHms(now.year, now.month, now.day, now.hour, now.minute, 0)
    lunar = solar.getLunar()
    eight_char = lunar.getEightChar()

    def pillar(text: str) -> dict:
        return {"stem": text[0], "branch": text[1], "text": text}

    # 择日信息
    day_yi = lunar.getDayYi() or []
    day_ji = lunar.getDayJi() or []
    ji_shen = lunar.getDayJiShen() or []
    xiong_sha = lunar.getDayXiongSha() or []

    return {
        "datetime": now.isoformat(),
        "lunar_text": lunar.toString(),
        "pillars": {
            "year": pillar(eight_char.getYear()),
            "month": pillar(eight_char.getMonth()),
            "day": pillar(eight_char.getDay()),
            "hour": pillar(eight_char.getTime()),
        },
        "heavenly_stems": [eight_char.getYear()[0], eight_char.getMonth()[0], eight_char.getDay()[0], eight_char.getTime()[0]],
        "earthly_branches": [eight_char.getYear()[1], eight_char.getMonth()[1], eight_char.getDay()[1], eight_char.getTime()[1]],
        "five_elements": [
            eight_char.getYearWuXing(),
            eight_char.getMonthWuXing(),
            eight_char.getDayWuXing(),
            eight_char.getTimeWuXing(),
        ],
        "almanac": {
            "yi": day_yi[:6],
            "ji": day_ji[:6],
            "ji_shen": ji_shen[:4],
            "xiong_sha": xiong_sha[:4],
        },
    }
