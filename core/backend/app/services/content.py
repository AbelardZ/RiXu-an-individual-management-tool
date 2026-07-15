import json
from datetime import date

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session
from lunar_python import Lunar, Solar

from app.core.security import utcnow
from app.models.auth import User
from app.models.content import (
    DailyTaskStatus,
    DailyTaskTemplate,
    JournalEntry,
    JournalEntryVersion,
    MilestoneDay,
    RangeTaskCategory,
    RangeReminder,
    Record,
    RecordType,
    Tag,
    TagLink,
)
from app.schemas.content import (
    JournalCreate,
    JournalUpdate,
    DailyTaskStatusUpdate,
    DailyTaskTemplateCreate,
    DailyTaskTemplateUpdate,
    MilestoneDayCreate,
    MilestoneDayUpdate,
    RecordCreate,
    RecordTypeCreate,
    RecordTypeUpdate,
    RecordUpdate,
    RangeTaskCategoryCreate,
    RangeTaskCategoryUpdate,
    RangeReminderCreate,
    RangeReminderUpdate,
    TagCreate,
    TagUpdate,
)


class ContentError(ValueError):
    pass


def _json(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _steps_json(steps) -> str:
    return _json([step.model_dump() for step in steps or []])


def get_owned_tag(db: Session, user: User, tag_id: int) -> Tag:
    tag = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.user_id == user.id, Tag.deleted_at.is_(None)))
    if not tag:
        raise ContentError("tag not found")
    return tag


def get_tags_by_ids(db: Session, user: User, tag_ids: list[int]) -> list[Tag]:
    if not tag_ids:
        return []
    tags = list(db.scalars(select(Tag).where(Tag.user_id == user.id, Tag.id.in_(tag_ids), Tag.deleted_at.is_(None))).all())
    if len({tag.id for tag in tags}) != len(set(tag_ids)):
        raise ContentError("one or more tags were not found")
    return tags


def list_target_tags(db: Session, user: User, target_type: str, target_id: int) -> list[Tag]:
    return list(
        db.scalars(
            select(Tag)
            .join(TagLink, Tag.id == TagLink.tag_id)
            .where(
                Tag.user_id == user.id,
                Tag.deleted_at.is_(None),
                TagLink.user_id == user.id,
                TagLink.target_type == target_type,
                TagLink.target_id == target_id,
            )
            .order_by(Tag.sort_order, Tag.name)
        ).all()
    )


def replace_tag_links(db: Session, user: User, target_type: str, target_id: int, tag_ids: list[int]) -> None:
    get_tags_by_ids(db, user, tag_ids)
    db.query(TagLink).filter(
        TagLink.user_id == user.id,
        TagLink.target_type == target_type,
        TagLink.target_id == target_id,
    ).delete(synchronize_session=False)
    for tag_id in dict.fromkeys(tag_ids):
        db.add(TagLink(user_id=user.id, tag_id=tag_id, target_type=target_type, target_id=target_id))


def list_tags(db: Session, user: User, include_archived: bool = False) -> list[Tag]:
    query = select(Tag).where(Tag.user_id == user.id, Tag.deleted_at.is_(None))
    if not include_archived:
        query = query.where(Tag.archived == 0)
    return list(db.scalars(query.order_by(Tag.sort_order, Tag.name)).all())


def create_tag(db: Session, user: User, payload: TagCreate) -> Tag:
    tag = Tag(user_id=user.id, **payload.model_dump())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


def update_tag(db: Session, user: User, tag_id: int, payload: TagUpdate) -> Tag:
    tag = get_owned_tag(db, user, tag_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "archived":
            value = 1 if value else 0
        setattr(tag, field, value)
    tag.updated_at = utcnow()
    db.commit()
    db.refresh(tag)
    return tag


def delete_tag(db: Session, user: User, tag_id: int) -> None:
    tag = get_owned_tag(db, user, tag_id)
    tag.deleted_at = utcnow()
    db.query(TagLink).filter(TagLink.user_id == user.id, TagLink.tag_id == tag_id).delete(synchronize_session=False)
    db.commit()


def create_tag_link(db: Session, user: User, tag_id: int, target_type: str, target_id: int) -> TagLink:
    get_owned_tag(db, user, tag_id)
    link = db.scalar(
        select(TagLink).where(
            TagLink.user_id == user.id,
            TagLink.tag_id == tag_id,
            TagLink.target_type == target_type,
            TagLink.target_id == target_id,
        )
    )
    if link:
        return link
    link = TagLink(user_id=user.id, tag_id=tag_id, target_type=target_type, target_id=target_id)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def delete_tag_link(db: Session, user: User, link_id: int) -> None:
    link = db.scalar(select(TagLink).where(TagLink.id == link_id, TagLink.user_id == user.id))
    if not link:
        raise ContentError("tag link not found")
    db.delete(link)
    db.commit()


def get_owned_record_type(db: Session, user: User, record_type_id: int) -> RecordType:
    item = db.scalar(select(RecordType).where(RecordType.id == record_type_id, RecordType.user_id == user.id, RecordType.deleted_at.is_(None)))
    if not item:
        raise ContentError("record type not found")
    return item


def list_record_types(db: Session, user: User, include_disabled: bool = False) -> list[RecordType]:
    query = select(RecordType).where(RecordType.user_id == user.id, RecordType.deleted_at.is_(None))
    if not include_disabled:
        query = query.where(RecordType.enabled == 1)
    return list(db.scalars(query.order_by(RecordType.sort_order, RecordType.name)).all())


def create_record_type(db: Session, user: User, payload: RecordTypeCreate) -> RecordType:
    data = payload.model_dump(exclude={"record_schema"})
    existing = db.scalar(select(RecordType).where(RecordType.user_id == user.id, RecordType.name == data["name"], RecordType.deleted_at.is_(None)))
    if existing:
        raise ContentError("record type with this name already exists")
    item = RecordType(user_id=user.id, **data, schema_json=_json(payload.record_schema))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_record_type(db: Session, user: User, record_type_id: int, payload: RecordTypeUpdate) -> RecordType:
    item = get_owned_record_type(db, user, record_type_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "record_schema":
            item.schema_json = _json(value)
        elif field == "enabled":
            item.enabled = 1 if value else 0
        elif field == "name" and value and value != item.name:
            existing = db.scalar(select(RecordType).where(RecordType.user_id == user.id, RecordType.name == value, RecordType.deleted_at.is_(None)))
            if existing:
                raise ContentError("record type with this name already exists")
            setattr(item, field, value)
        else:
            setattr(item, field, value)
    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item


def delete_record_type(db: Session, user: User, record_type_id: int) -> None:
    item = get_owned_record_type(db, user, record_type_id)
    item.deleted_at = utcnow()
    db.commit()


def get_owned_record(db: Session, user: User, record_id: int) -> Record:
    item = db.scalar(select(Record).where(Record.id == record_id, Record.user_id == user.id, Record.deleted_at.is_(None)))
    if not item:
        raise ContentError("record not found")
    return item


def list_records(
    db: Session,
    user: User,
    *,
    date_value: date | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    record_type_id: int | None = None,
    tag_id: int | None = None,
) -> list[Record]:
    query = select(Record).where(Record.user_id == user.id, Record.deleted_at.is_(None))
    if date_value:
        query = query.where(Record.record_date == date_value)
    if start_date:
        query = query.where(Record.record_date >= start_date)
    if end_date:
        query = query.where(Record.record_date <= end_date)
    if record_type_id:
        query = query.where(Record.record_type_id == record_type_id)
    if tag_id:
        query = query.join(TagLink, and_(TagLink.target_id == Record.id, TagLink.target_type == "record")).where(TagLink.tag_id == tag_id, TagLink.user_id == user.id)
    return list(db.scalars(query.order_by(Record.record_date.desc(), Record.occurred_at.desc().nullslast(), Record.created_at.desc())).all())


def create_record(db: Session, user: User, payload: RecordCreate) -> Record:
    get_owned_record_type(db, user, payload.record_type_id)
    item = Record(
        user_id=user.id,
        record_type_id=payload.record_type_id,
        record_date=payload.record_date,
        occurred_at=payload.occurred_at,
        data_json=_json(payload.data),
        note=payload.note,
    )
    db.add(item)
    db.flush()
    replace_tag_links(db, user, "record", item.id, payload.tag_ids)
    db.commit()
    db.refresh(item)
    return item


def update_record(db: Session, user: User, record_id: int, payload: RecordUpdate) -> Record:
    item = get_owned_record(db, user, record_id)
    update_data = payload.model_dump(exclude_unset=True)
    if "record_type_id" in update_data and update_data["record_type_id"] is not None:
        get_owned_record_type(db, user, update_data["record_type_id"])
    for field, value in update_data.items():
        if field == "data":
            item.data_json = _json(value)
        elif field == "tag_ids":
            replace_tag_links(db, user, "record", item.id, value or [])
        else:
            setattr(item, field, value)
    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item


def delete_record(db: Session, user: User, record_id: int) -> None:
    item = get_owned_record(db, user, record_id)
    item.deleted_at = utcnow()
    db.query(TagLink).filter(TagLink.user_id == user.id, TagLink.target_type == "record", TagLink.target_id == record_id).delete(synchronize_session=False)
    db.commit()


def get_owned_journal(db: Session, user: User, journal_id: int) -> JournalEntry:
    item = db.scalar(select(JournalEntry).where(JournalEntry.id == journal_id, JournalEntry.user_id == user.id, JournalEntry.deleted_at.is_(None)))
    if not item:
        raise ContentError("journal not found")
    return item


def _write_journal_version(db: Session, user: User, journal: JournalEntry, change_summary: str | None) -> None:
    tag_snapshot = [tag.__dict__ for tag in list_target_tags(db, user, "journal_entry", journal.id)]
    cleaned_tags = [
        {"id": tag["id"], "name": tag["name"], "color": tag["color"], "description": tag["description"]}
        for tag in tag_snapshot
    ]
    version_no = db.scalar(
        select(func.coalesce(func.max(JournalEntryVersion.version_no), 0)).where(JournalEntryVersion.journal_entry_id == journal.id)
    ) + 1
    db.add(
        JournalEntryVersion(
            journal_entry_id=journal.id,
            user_id=user.id,
            version_no=version_no,
            title=journal.title,
            markdown_content=journal.markdown_content,
            tag_snapshot_json=_json(cleaned_tags),
            change_summary=change_summary,
        )
    )


def list_journals(
    db: Session,
    user: User,
    *,
    date_value: date | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    tag_id: int | None = None,
    keyword: str | None = None,
) -> list[JournalEntry]:
    query = select(JournalEntry).where(JournalEntry.user_id == user.id, JournalEntry.deleted_at.is_(None))
    if date_value:
        query = query.where(JournalEntry.entry_date == date_value)
    if start_date:
        query = query.where(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.where(JournalEntry.entry_date <= end_date)
    if tag_id:
        query = query.join(TagLink, and_(TagLink.target_id == JournalEntry.id, TagLink.target_type == "journal_entry")).where(TagLink.tag_id == tag_id, TagLink.user_id == user.id)
    if keyword:
        like = f"%{keyword}%"
        query = query.where(or_(JournalEntry.title.like(like), JournalEntry.markdown_content.like(like), JournalEntry.summary.like(like)))
    return list(db.scalars(query.order_by(JournalEntry.entry_date.desc(), JournalEntry.updated_at.desc())).all())


def create_journal(db: Session, user: User, payload: JournalCreate) -> JournalEntry:
    item = JournalEntry(
        user_id=user.id,
        entry_date=payload.entry_date,
        title=payload.title,
        markdown_content=payload.markdown_content,
        summary=payload.summary,
    )
    db.add(item)
    db.flush()
    replace_tag_links(db, user, "journal_entry", item.id, payload.tag_ids)
    _write_journal_version(db, user, item, payload.change_summary)
    db.commit()
    db.refresh(item)
    return item


def update_journal(db: Session, user: User, journal_id: int, payload: JournalUpdate) -> JournalEntry:
    item = get_owned_journal(db, user, journal_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "tag_ids":
            replace_tag_links(db, user, "journal_entry", item.id, value or [])
        elif field != "change_summary":
            setattr(item, field, value)
    item.updated_at = utcnow()
    db.flush()
    _write_journal_version(db, user, item, payload.change_summary)
    db.commit()
    db.refresh(item)
    return item


def delete_journal(db: Session, user: User, journal_id: int) -> None:
    item = get_owned_journal(db, user, journal_id)
    item.deleted_at = utcnow()
    db.query(TagLink).filter(TagLink.user_id == user.id, TagLink.target_type == "journal_entry", TagLink.target_id == journal_id).delete(synchronize_session=False)
    db.commit()


def list_journal_versions(db: Session, user: User, journal_id: int) -> list[JournalEntryVersion]:
    get_owned_journal(db, user, journal_id)
    return list(
        db.scalars(
            select(JournalEntryVersion)
            .where(JournalEntryVersion.user_id == user.id, JournalEntryVersion.journal_entry_id == journal_id)
            .order_by(JournalEntryVersion.version_no.desc())
        ).all()
    )


def get_journal_version(db: Session, user: User, journal_id: int, version_id: int) -> JournalEntryVersion:
    get_owned_journal(db, user, journal_id)
    version = db.scalar(
        select(JournalEntryVersion).where(
            JournalEntryVersion.user_id == user.id,
            JournalEntryVersion.journal_entry_id == journal_id,
            JournalEntryVersion.id == version_id,
        )
    )
    if not version:
        raise ContentError("journal version not found")
    return version


def get_owned_daily_task_template(db: Session, user: User, template_id: int) -> DailyTaskTemplate:
    item = db.scalar(
        select(DailyTaskTemplate).where(
            DailyTaskTemplate.id == template_id,
            DailyTaskTemplate.user_id == user.id,
            DailyTaskTemplate.deleted_at.is_(None),
        )
    )
    if not item:
        raise ContentError("daily task template not found")
    return item


def list_daily_task_templates(db: Session, user: User, include_disabled: bool = False) -> list[DailyTaskTemplate]:
    query = select(DailyTaskTemplate).where(DailyTaskTemplate.user_id == user.id, DailyTaskTemplate.deleted_at.is_(None))
    if not include_disabled:
        query = query.where(DailyTaskTemplate.enabled == 1)
    return list(db.scalars(query.order_by(DailyTaskTemplate.sort_order, DailyTaskTemplate.created_at)).all())


def create_daily_task_template(db: Session, user: User, payload: DailyTaskTemplateCreate) -> DailyTaskTemplate:
    data = payload.model_dump(exclude={"tag_ids"})
    data["enabled"] = 1 if data["enabled"] else 0
    item = DailyTaskTemplate(user_id=user.id, **data)
    db.add(item)
    db.flush()
    replace_tag_links(db, user, "daily_task_template", item.id, payload.tag_ids)
    db.commit()
    db.refresh(item)
    return item


def update_daily_task_template(db: Session, user: User, template_id: int, payload: DailyTaskTemplateUpdate) -> DailyTaskTemplate:
    item = get_owned_daily_task_template(db, user, template_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "tag_ids":
            replace_tag_links(db, user, "daily_task_template", item.id, value or [])
        elif field == "enabled":
            item.enabled = 1 if value else 0
        else:
            setattr(item, field, value)
    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item


def delete_daily_task_template(db: Session, user: User, template_id: int) -> None:
    item = get_owned_daily_task_template(db, user, template_id)
    item.deleted_at = utcnow()
    db.query(TagLink).filter(TagLink.user_id == user.id, TagLink.target_type == "daily_task_template", TagLink.target_id == template_id).delete(synchronize_session=False)
    db.commit()


def get_daily_task_status(db: Session, user: User, template_id: int, task_date: date) -> DailyTaskStatus | None:
    return db.scalar(
        select(DailyTaskStatus).where(
            DailyTaskStatus.user_id == user.id,
            DailyTaskStatus.template_id == template_id,
            DailyTaskStatus.task_date == task_date,
            DailyTaskStatus.deleted_at.is_(None),
        )
    )


def list_daily_tasks_for_date(db: Session, user: User, task_date: date) -> list[tuple[DailyTaskTemplate, DailyTaskStatus | None]]:
    templates = list_daily_task_templates(db, user)
    return [(template, get_daily_task_status(db, user, template.id, task_date)) for template in templates]


def update_daily_task_status(db: Session, user: User, template_id: int, task_date: date, payload: DailyTaskStatusUpdate) -> DailyTaskStatus:
    get_owned_daily_task_template(db, user, template_id)
    item = get_daily_task_status(db, user, template_id, task_date)
    if not item:
        item = DailyTaskStatus(user_id=user.id, template_id=template_id, task_date=task_date)
        db.add(item)
    item.completed = 1 if payload.completed else 0
    item.completed_at = utcnow() if payload.completed else None
    item.note = payload.note
    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item


def get_owned_range_reminder(db: Session, user: User, reminder_id: int) -> RangeReminder:
    item = db.scalar(
        select(RangeReminder).where(
            RangeReminder.id == reminder_id,
            RangeReminder.user_id == user.id,
            RangeReminder.deleted_at.is_(None),
        )
    )
    if not item:
        raise ContentError("range reminder not found")
    return item


def get_owned_range_category(db: Session, user: User, category_id: int) -> RangeTaskCategory:
    item = db.scalar(
        select(RangeTaskCategory).where(
            RangeTaskCategory.id == category_id,
            RangeTaskCategory.user_id == user.id,
            RangeTaskCategory.deleted_at.is_(None),
        )
    )
    if not item:
        raise ContentError("range task category not found")
    return item


def list_range_categories(db: Session, user: User) -> list[RangeTaskCategory]:
    return list(
        db.scalars(
            select(RangeTaskCategory)
            .where(RangeTaskCategory.user_id == user.id, RangeTaskCategory.deleted_at.is_(None))
            .order_by(RangeTaskCategory.sort_order, RangeTaskCategory.created_at)
        ).all()
    )


def create_range_category(db: Session, user: User, payload: RangeTaskCategoryCreate) -> RangeTaskCategory:
    item = RangeTaskCategory(user_id=user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_range_category(db: Session, user: User, category_id: int, payload: RangeTaskCategoryUpdate) -> RangeTaskCategory:
    item = get_owned_range_category(db, user, category_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item


def delete_range_category(db: Session, user: User, category_id: int) -> None:
    item = get_owned_range_category(db, user, category_id)
    item.deleted_at = utcnow()
    db.query(RangeReminder).filter(RangeReminder.user_id == user.id, RangeReminder.category_id == category_id).update(
        {RangeReminder.category_id: None},
        synchronize_session=False,
    )
    db.commit()


def _range_visible_on(item: RangeReminder, target_date: date) -> bool:
    if item.display_mode == "start_only":
        return target_date == item.start_date
    if item.display_mode == "end_only":
        return target_date == item.end_date
    if item.display_mode == "start_and_end":
        return target_date in {item.start_date, item.end_date}
    return item.start_date <= target_date <= item.end_date


def list_range_reminders(
    db: Session,
    user: User,
    *,
    date_value: date | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    status_value: str | None = None,
    tag_id: int | None = None,
    category_id: int | None = None,
) -> list[RangeReminder]:
    query = select(RangeReminder).where(RangeReminder.user_id == user.id, RangeReminder.deleted_at.is_(None))
    if status_value:
        query = query.where(RangeReminder.status == status_value)
    if category_id is not None:
        query = query.where(RangeReminder.category_id == category_id)
    if date_value:
        query = query.where(RangeReminder.start_date <= date_value, RangeReminder.end_date >= date_value)
    if start_date:
        query = query.where(RangeReminder.end_date >= start_date)
    if end_date:
        query = query.where(RangeReminder.start_date <= end_date)
    if tag_id:
        query = query.join(TagLink, and_(TagLink.target_id == RangeReminder.id, TagLink.target_type == "range_reminder")).where(TagLink.tag_id == tag_id, TagLink.user_id == user.id)
    items = list(db.scalars(query.order_by(RangeReminder.start_date, RangeReminder.end_date, RangeReminder.created_at)).all())
    if date_value:
        items = [item for item in items if _range_visible_on(item, date_value)]
    return items


def create_range_reminder(db: Session, user: User, payload: RangeReminderCreate) -> RangeReminder:
    data = payload.model_dump(exclude={"tag_ids", "steps"})
    if data.get("category_id") is not None:
        get_owned_range_category(db, user, data["category_id"])
    data["steps_json"] = _steps_json(payload.steps)
    data["completed_at"] = utcnow() if data.get("status") == "completed" else None
    item = RangeReminder(user_id=user.id, **data)
    db.add(item)
    db.flush()
    replace_tag_links(db, user, "range_reminder", item.id, payload.tag_ids)
    db.commit()
    db.refresh(item)
    return item


def update_range_reminder(db: Session, user: User, reminder_id: int, payload: RangeReminderUpdate) -> RangeReminder:
    item = get_owned_range_reminder(db, user, reminder_id)
    update_data = payload.model_dump(exclude_unset=True)
    next_start = update_data.get("start_date", item.start_date)
    next_end = update_data.get("end_date", item.end_date)
    if next_end < next_start:
        raise ContentError("end_date must be on or after start_date")
    for field, value in update_data.items():
        if field == "tag_ids":
            replace_tag_links(db, user, "range_reminder", item.id, value or [])
        elif field == "steps":
            item.steps_json = _steps_json(payload.steps)
        elif field == "category_id":
            if value is not None:
                get_owned_range_category(db, user, value)
            item.category_id = value
        elif field == "status":
            item.status = value
            item.completed_at = utcnow() if value == "completed" else None
        else:
            setattr(item, field, value)
    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item


def delete_range_reminder(db: Session, user: User, reminder_id: int) -> None:
    item = get_owned_range_reminder(db, user, reminder_id)
    item.deleted_at = utcnow()
    db.query(TagLink).filter(TagLink.user_id == user.id, TagLink.target_type == "range_reminder", TagLink.target_id == reminder_id).delete(synchronize_session=False)
    db.commit()


def get_owned_milestone_day(db: Session, user: User, milestone_id: int) -> MilestoneDay:
    item = db.scalar(select(MilestoneDay).where(MilestoneDay.id == milestone_id, MilestoneDay.user_id == user.id, MilestoneDay.deleted_at.is_(None)))
    if not item:
        raise ContentError("milestone day not found")
    return item


def _validate_milestone_shape(item: MilestoneDay) -> None:
    if item.date_type == "weekly" and (item.day is None or item.day < 1 or item.day > 7):
        raise ContentError("weekday is required for weekly milestones")
    if item.date_type == "monthly" and (item.day is None or item.day < 1 or item.day > 31):
        raise ContentError("day is required for monthly milestones")
    if item.date_type == "yearly" and (item.month is None or item.day is None):
        raise ContentError("month and day are required for yearly milestones")
    if item.date_type == "once" and item.target_date is None:
        raise ContentError("target_date is required for once milestones")
    if item.month and item.day and getattr(item, "calendar_type", "solar") != "lunar":
        try:
            date(2024, item.month, item.day)
        except ValueError as exc:
            raise ContentError("month/day is not a valid date") from exc
    if getattr(item, "calendar_type", "solar") == "lunar":
        if item.month is not None and (item.month < 1 or item.month > 12):
            raise ContentError("lunar month is not valid")
        if item.day is not None and (item.day < 1 or item.day > 30):
            raise ContentError("lunar day is not valid")


def _solar_date_from_lunar(lunar_year: int, month: int, day: int) -> date | None:
    try:
        solar = Lunar.fromYmd(lunar_year, month, day).getSolar()
        return date(solar.getYear(), solar.getMonth(), solar.getDay())
    except Exception:
        return None


def _lunar_parts(day: date) -> tuple[int, int, int]:
    lunar = Solar.fromYmd(day.year, day.month, day.day).getLunar()
    return lunar.getYear(), abs(lunar.getMonth()), lunar.getDay()


def _milestone_matches_date(item: MilestoneDay, day: date) -> bool:
    if item.date_type == "once":
        return item.target_date == day
    if item.date_type == "weekly":
        return item.day is not None and day.isoweekday() == item.day
    if getattr(item, "calendar_type", "solar") == "lunar":
        _, lunar_month, lunar_day = _lunar_parts(day)
        if item.date_type == "monthly":
            return item.day is not None and lunar_day == item.day
        return item.month is not None and item.day is not None and lunar_month == item.month and lunar_day == item.day
    if item.date_type == "monthly":
        return item.day is not None and day.day == item.day
    return item.month is not None and item.day is not None and day.month == item.month and day.day == item.day


def _milestone_occurrence(item: MilestoneDay, reference_date: date) -> date | None:
    if item.date_type == "once":
        return item.target_date
    if item.date_type == "weekly":
        if item.day is None:
            return None
        return reference_date if reference_date.isoweekday() == item.day else None
    if item.date_type == "monthly":
        if item.day is None:
            return None
        if getattr(item, "calendar_type", "solar") == "lunar":
            lunar_year, lunar_month, _ = _lunar_parts(reference_date)
            return _solar_date_from_lunar(lunar_year, lunar_month, item.day)
        try:
            return date(reference_date.year, reference_date.month, item.day)
        except ValueError:
            return None
    if item.month is None or item.day is None:
        return None
    if getattr(item, "calendar_type", "solar") == "lunar":
        lunar_year, _, _ = _lunar_parts(reference_date)
        return _solar_date_from_lunar(lunar_year, item.month, item.day)
    try:
        occurrence = date(reference_date.year, item.month, item.day)
    except ValueError:
        occurrence = date(reference_date.year, 2, 28)
    return occurrence


def _countdown_label(days: int) -> str:
    if days > 0:
        return f"{days} 天后"
    if days == 0:
        return "今天"
    return f"已过去 {abs(days)} 天"


def milestone_view_data(item: MilestoneDay, reference_date: date) -> tuple[date | None, int | None, str | None, int | None]:
    occurrence = _milestone_occurrence(item, reference_date)
    if occurrence is None:
        return None, None, None, None
    countdown_days = (occurrence - reference_date).days if item.show_countdown else None
    label = _countdown_label(countdown_days) if countdown_days is not None else None
    anniversary = None
    if item.start_year and item.date_type == "yearly":
        if getattr(item, "calendar_type", "solar") == "lunar":
            lunar_year, _, _ = _lunar_parts(occurrence)
            anniversary = lunar_year - item.start_year
        else:
            anniversary = occurrence.year - item.start_year
    return occurrence, countdown_days, label, anniversary


def list_milestone_days(
    db: Session,
    user: User,
    *,
    reference_date: date,
    include_disabled: bool = False,
    date_value: date | None = None,
    date_type: str | None = None,
    tag_id: int | None = None,
) -> list[MilestoneDay]:
    query = select(MilestoneDay).where(MilestoneDay.user_id == user.id, MilestoneDay.deleted_at.is_(None))
    if not include_disabled:
        query = query.where(MilestoneDay.enabled == 1)
    if date_type:
        query = query.where(MilestoneDay.date_type == date_type)
    if tag_id:
        query = query.join(TagLink, and_(TagLink.target_id == MilestoneDay.id, TagLink.target_type == "milestone_day")).where(TagLink.tag_id == tag_id, TagLink.user_id == user.id)
    items = list(db.scalars(query.order_by(MilestoneDay.target_date, MilestoneDay.month, MilestoneDay.day, MilestoneDay.created_at)).all())
    if date_value:
        items = [item for item in items if _milestone_matches_date(item, date_value)]
    else:
        filtered = []
        for item in items:
            occurrence = _milestone_occurrence(item, reference_date)
            if occurrence is None:
                continue
            days = (occurrence - reference_date).days
            if item.date_type == "once" and days < 0 and not item.show_after_due:
                continue
            if days >= -3660 and days <= max(item.remind_days_before, 3660):
                filtered.append(item)
        items = filtered
    return items


def create_milestone_day(db: Session, user: User, payload: MilestoneDayCreate) -> MilestoneDay:
    data = payload.model_dump(exclude={"tag_ids"})
    for field in ("show_countdown", "show_after_due", "completed", "enabled"):
        data[field] = 1 if data[field] else 0
    item = MilestoneDay(user_id=user.id, **data)
    _validate_milestone_shape(item)
    if item.completed and item.completed_at is None:
        item.completed_at = utcnow()
    db.add(item)
    db.flush()
    replace_tag_links(db, user, "milestone_day", item.id, payload.tag_ids)
    db.commit()
    db.refresh(item)
    return item


def update_milestone_day(db: Session, user: User, milestone_id: int, payload: MilestoneDayUpdate) -> MilestoneDay:
    item = get_owned_milestone_day(db, user, milestone_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "tag_ids":
            replace_tag_links(db, user, "milestone_day", item.id, value or [])
        elif field in {"show_countdown", "show_after_due", "completed", "enabled"}:
            setattr(item, field, 1 if value else 0)
            if field == "completed":
                item.completed_at = utcnow() if value else None
        else:
            setattr(item, field, value)
    _validate_milestone_shape(item)
    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    return item


def delete_milestone_day(db: Session, user: User, milestone_id: int) -> None:
    item = get_owned_milestone_day(db, user, milestone_id)
    item.deleted_at = utcnow()
    db.query(TagLink).filter(TagLink.user_id == user.id, TagLink.target_type == "milestone_day", TagLink.target_id == milestone_id).delete(synchronize_session=False)
    db.commit()
