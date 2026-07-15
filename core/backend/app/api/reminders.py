import os
import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_content_db, get_current_storage, get_current_user
from app.models.auth import User, UserStorage
from app.models.content import Attachment
from app.schemas.content import (
    DailyTaskItemResponse,
    DailyTaskStatusUpdate,
    DailyTaskTemplateCreate,
    DailyTaskTemplateResponse,
    DailyTaskTemplateUpdate,
    MilestoneDayCreate,
    MilestoneDayResponse,
    MilestoneDayUpdate,
    RangeTaskCategoryCreate,
    RangeTaskCategoryResponse,
    RangeTaskCategoryUpdate,
    RangeReminderCreate,
    RangeReminderResponse,
    RangeReminderUpdate,
)
from app.services.content import (
    ContentError,
    create_daily_task_template,
    create_milestone_day,
    create_range_category,
    create_range_reminder,
    delete_daily_task_template,
    delete_milestone_day,
    delete_range_category,
    delete_range_reminder,
    get_owned_daily_task_template,
    get_owned_milestone_day,
    get_owned_range_category,
    get_owned_range_reminder,
    list_daily_task_templates,
    list_daily_tasks_for_date,
    list_milestone_days,
    list_range_categories,
    list_range_reminders,
    list_target_tags,
    milestone_view_data,
    update_daily_task_status,
    update_daily_task_template,
    update_milestone_day,
    update_range_category,
    update_range_reminder,
)
from app.core.workspace import unlink_storage_file, upload_url, workspace_upload_dir

router = APIRouter(tags=["reminders"])


def _daily_template_response(db: Session, user: User, item) -> DailyTaskTemplateResponse:
    return DailyTaskTemplateResponse.from_model(item, list_target_tags(db, user, "daily_task_template", item.id))


def _range_response(db: Session, user: User, item) -> RangeReminderResponse:
    return RangeReminderResponse.from_model(item, list_target_tags(db, user, "range_reminder", item.id))


def _range_category_response(item) -> RangeTaskCategoryResponse:
    return RangeTaskCategoryResponse.model_validate(item)


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


@router.get("/daily-task-templates", response_model=list[DailyTaskTemplateResponse])
def get_daily_task_templates(
    include_disabled: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> list[DailyTaskTemplateResponse]:
    return [_daily_template_response(db, current_user, item) for item in list_daily_task_templates(db, current_user, include_disabled)]


@router.post("/daily-task-templates", response_model=DailyTaskTemplateResponse, status_code=status.HTTP_201_CREATED)
def post_daily_task_template(
    payload: DailyTaskTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> DailyTaskTemplateResponse:
    try:
        item = create_daily_task_template(db, current_user, payload)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _daily_template_response(db, current_user, item)


@router.patch("/daily-task-templates/{template_id}", response_model=DailyTaskTemplateResponse)
def patch_daily_task_template(
    template_id: int,
    payload: DailyTaskTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> DailyTaskTemplateResponse:
    try:
        item = update_daily_task_template(db, current_user, template_id, payload)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _daily_template_response(db, current_user, item)


@router.delete("/daily-task-templates/{template_id}", response_model=dict[str, bool])
def remove_daily_task_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> dict[str, bool]:
    try:
        delete_daily_task_template(db, current_user, template_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"ok": True}


@router.get("/daily-tasks", response_model=list[DailyTaskItemResponse])
def get_daily_tasks(
    task_date: date = Query(alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> list[DailyTaskItemResponse]:
    items = []
    for template, task_status in list_daily_tasks_for_date(db, current_user, task_date):
        items.append(
            DailyTaskItemResponse(
                template=_daily_template_response(db, current_user, template),
                task_date=task_date,
                completed=bool(task_status.completed) if task_status else False,
                completed_at=task_status.completed_at if task_status else None,
                note=task_status.note if task_status else None,
            )
        )
    return items


@router.patch("/daily-tasks/{template_id}/{task_date}", response_model=DailyTaskItemResponse)
def patch_daily_task_status(
    template_id: int,
    task_date: date,
    payload: DailyTaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> DailyTaskItemResponse:
    try:
        task_status = update_daily_task_status(db, current_user, template_id, task_date, payload)
        template = get_owned_daily_task_template(db, current_user, template_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return DailyTaskItemResponse(
        template=_daily_template_response(db, current_user, template),
        task_date=task_date,
        completed=bool(task_status.completed),
        completed_at=task_status.completed_at,
        note=task_status.note,
    )


@router.get("/range-task-categories", response_model=list[RangeTaskCategoryResponse])
def get_range_task_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> list[RangeTaskCategoryResponse]:
    return [_range_category_response(item) for item in list_range_categories(db, current_user)]


@router.post("/range-task-categories", response_model=RangeTaskCategoryResponse, status_code=status.HTTP_201_CREATED)
def post_range_task_category(
    payload: RangeTaskCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> RangeTaskCategoryResponse:
    item = create_range_category(db, current_user, payload)
    return _range_category_response(item)


@router.patch("/range-task-categories/{category_id}", response_model=RangeTaskCategoryResponse)
def patch_range_task_category(
    category_id: int,
    payload: RangeTaskCategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> RangeTaskCategoryResponse:
    try:
        item = update_range_category(db, current_user, category_id, payload)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _range_category_response(item)


@router.delete("/range-task-categories/{category_id}", response_model=dict[str, bool])
def remove_range_task_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> dict[str, bool]:
    try:
        delete_range_category(db, current_user, category_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"ok": True}


@router.get("/range-reminders", response_model=list[RangeReminderResponse])
def get_range_reminders(
    date_value: date | None = Query(default=None, alias="date"),
    start_date: date | None = None,
    end_date: date | None = None,
    status_value: str | None = Query(default=None, alias="status"),
    tag_id: int | None = None,
    category_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> list[RangeReminderResponse]:
    items = list_range_reminders(
        db,
        current_user,
        date_value=date_value,
        start_date=start_date,
        end_date=end_date,
        status_value=status_value,
        tag_id=tag_id,
        category_id=category_id,
    )
    return [_range_response(db, current_user, item) for item in items]


@router.post("/range-reminders", response_model=RangeReminderResponse, status_code=status.HTTP_201_CREATED)
def post_range_reminder(
    payload: RangeReminderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> RangeReminderResponse:
    try:
        item = create_range_reminder(db, current_user, payload)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _range_response(db, current_user, item)


@router.get("/range-reminders/{reminder_id}", response_model=RangeReminderResponse)
def get_range_reminder(reminder_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> RangeReminderResponse:
    try:
        item = get_owned_range_reminder(db, current_user, reminder_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _range_response(db, current_user, item)


@router.patch("/range-reminders/{reminder_id}", response_model=RangeReminderResponse)
def patch_range_reminder(
    reminder_id: int,
    payload: RangeReminderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> RangeReminderResponse:
    try:
        item = update_range_reminder(db, current_user, reminder_id, payload)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _range_response(db, current_user, item)


@router.delete("/range-reminders/{reminder_id}", response_model=dict[str, bool])
def remove_range_reminder(reminder_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_content_db)) -> dict[str, bool]:
    try:
        delete_range_reminder(db, current_user, reminder_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"ok": True}


@router.get("/milestone-days", response_model=list[MilestoneDayResponse])
def get_milestone_days(
    reference_date: date | None = None,
    date_value: date | None = Query(default=None, alias="date"),
    include_disabled: bool = Query(default=False),
    date_type: str | None = None,
    tag_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> list[MilestoneDayResponse]:
    actual_reference_date = reference_date or date.today()
    items = list_milestone_days(
        db,
        current_user,
        reference_date=actual_reference_date,
        include_disabled=include_disabled,
        date_value=date_value,
        date_type=date_type,
        tag_id=tag_id,
    )
    view_date = date_value or actual_reference_date
    return [_milestone_response(db, current_user, item, view_date) for item in items]


@router.post("/milestone-days", response_model=MilestoneDayResponse, status_code=status.HTTP_201_CREATED)
def post_milestone_day(
    payload: MilestoneDayCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> MilestoneDayResponse:
    try:
        item = create_milestone_day(db, current_user, payload)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _milestone_response(db, current_user, item, date.today())


@router.get("/milestone-days/{milestone_id}", response_model=MilestoneDayResponse)
def get_milestone_day(
    milestone_id: int,
    reference_date: date | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> MilestoneDayResponse:
    try:
        item = get_owned_milestone_day(db, current_user, milestone_id)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _milestone_response(db, current_user, item, reference_date or date.today())


@router.patch("/milestone-days/{milestone_id}", response_model=MilestoneDayResponse)
def patch_milestone_day(
    milestone_id: int,
    payload: MilestoneDayUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
    storage: UserStorage = Depends(get_current_storage),
) -> MilestoneDayResponse:
    try:
        # 如果更新中包含 background_url 且与旧值不同，先记录旧路径
        old_bg = None
        update_data = payload.model_dump(exclude_unset=True)
        if "background_url" in update_data:
            old_item = get_owned_milestone_day(db, current_user, milestone_id)
            old_bg = old_item.background_url
        item = update_milestone_day(db, current_user, milestone_id, payload)
        # 删除旧背景文件（当 background_url 被更新或清空时）
        if old_bg and old_bg != item.background_url:
            unlink_storage_file(old_bg, Path(storage.workspace_path))
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _milestone_response(db, current_user, item, date.today())


@router.post("/milestone-days/{milestone_id}/background", response_model=MilestoneDayResponse)
async def upload_milestone_background(
    milestone_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
    storage: UserStorage = Depends(get_current_storage),
) -> MilestoneDayResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只支持图片文件")
    ext = os.path.splitext(file.filename or "background.png")[1] or ".png"
    if ext.lower() not in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片不能超过 8MB")
    workspace_path = Path(storage.workspace_path)
    target_dir = workspace_upload_dir(workspace_path, "milestones")
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{current_user.id}_{milestone_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = target_dir / filename
    filepath.write_bytes(content)
    try:
        # 先获取旧背景路径，再更新
        old_item = get_owned_milestone_day(db, current_user, milestone_id)
        old_bg = old_item.background_url
        background_url = upload_url("milestones", filename, storage.id)
        item = update_milestone_day(db, current_user, milestone_id, MilestoneDayUpdate(background_url=background_url))
        db.add(
            Attachment(
                owner_type="milestone_day",
                owner_id=milestone_id,
                file_name=file.filename or filename,
                file_path=background_url,
                mime_type=file.content_type,
                size=len(content),
            )
        )
        db.commit()
        # 删除旧背景文件
        unlink_storage_file(old_bg, workspace_path)
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _milestone_response(db, current_user, item, date.today())


@router.delete("/milestone-days/{milestone_id}", response_model=dict[str, bool])
def remove_milestone_day(
    milestone_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
    storage: UserStorage = Depends(get_current_storage),
) -> dict[str, bool]:
    try:
        # 先获取背景路径再删除
        item = get_owned_milestone_day(db, current_user, milestone_id)
        old_bg = item.background_url
        delete_milestone_day(db, current_user, milestone_id)
        # 删除关联的背景文件
        unlink_storage_file(old_bg, Path(storage.workspace_path))
    except ContentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"ok": True}
