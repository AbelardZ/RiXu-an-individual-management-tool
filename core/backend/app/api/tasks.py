"""
番茄钟 & 任务日志 API
"""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_content_db, get_current_user
from app.models.auth import User
from app.models.content import DailyTaskStatus, DailyTaskTemplate, RangeReminder, RangeTaskCategory, TaskTimerSession, TaskWorkLog
from app.schemas.content import (
    TaskCompletionStats,
    TaskTimeStats,
    TimerSessionCreate,
    TimerSessionResponse,
    TimerSessionUpdate,
    TimeStatsResponse,
    WorkLogCreate,
    WorkLogResponse,
    WorkLogUpdate,
)
from app.core.security import utcnow

router = APIRouter(prefix="/tasks", tags=["tasks"])


# ── 番茄钟计时 ──

@router.post("/timer", response_model=TimerSessionResponse, status_code=status.HTTP_201_CREATED)
def start_timer(
    payload: TimerSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> TimerSessionResponse:
    session = TaskTimerSession(
        user_id=current_user.id,
        task_type=payload.task_type,
        task_id=payload.task_id,
        planned_minutes=payload.planned_minutes,
        timer_mode=payload.timer_mode,
        status="running",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return TimerSessionResponse.model_validate(session)


@router.patch("/timer/{session_id}", response_model=TimerSessionResponse)
def update_timer(
    session_id: int,
    payload: TimerSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> TimerSessionResponse:
    session = db.scalar(
        select(TaskTimerSession).where(
            TaskTimerSession.id == session_id,
            TaskTimerSession.user_id == current_user.id,
        )
    )
    if not session:
        raise HTTPException(status_code=404, detail="计时会话不存在")

    if payload.status:
        session.status = payload.status
        if payload.status in ("completed", "cancelled"):
            session.ended_at = utcnow()
    if payload.actual_seconds is not None:
        session.actual_seconds = payload.actual_seconds
    session.updated_at = utcnow()
    db.commit()
    db.refresh(session)
    return TimerSessionResponse.model_validate(session)


@router.delete("/timer/{session_id}")
def delete_timer_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> dict:
    session = db.scalar(
        select(TaskTimerSession).where(
            TaskTimerSession.id == session_id,
            TaskTimerSession.user_id == current_user.id,
        )
    )
    if not session:
        raise HTTPException(status_code=404, detail="计时会话不存在")
    db.delete(session)
    db.commit()
    return {"ok": True}


@router.get("/timer/active")
def get_active_timer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> TimerSessionResponse | dict:
    session = db.scalar(
        select(TaskTimerSession)
        .where(
            TaskTimerSession.user_id == current_user.id,
            TaskTimerSession.status == "running",
        )
        .order_by(TaskTimerSession.started_at.desc())
    )
    if not session:
        return {"id": None}
    return TimerSessionResponse.model_validate(session)


@router.get("/timer/sessions")
def list_timer_sessions(
    task_type: str | None = Query(default=None),
    task_id: int | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> list[TimerSessionResponse]:
    query = select(TaskTimerSession).where(TaskTimerSession.user_id == current_user.id)
    if task_type:
        query = query.where(TaskTimerSession.task_type == task_type)
    if task_id:
        query = query.where(TaskTimerSession.task_id == task_id)
    sessions = db.scalars(query.order_by(TaskTimerSession.started_at.desc()).limit(limit)).all()
    return [TimerSessionResponse.model_validate(s) for s in sessions]


# ── 任务工作日志 ──

@router.post("/work-log", response_model=WorkLogResponse, status_code=status.HTTP_201_CREATED)
def create_work_log(
    payload: WorkLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> WorkLogResponse:
    log = TaskWorkLog(
        user_id=current_user.id,
        task_type=payload.task_type,
        task_id=payload.task_id,
        title=payload.title,
        content=payload.content,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return WorkLogResponse.model_validate(log)


@router.patch("/work-log/{log_id}", response_model=WorkLogResponse)
def update_work_log(
    log_id: int,
    payload: WorkLogUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> WorkLogResponse:
    log = db.scalar(
        select(TaskWorkLog).where(
            TaskWorkLog.id == log_id,
            TaskWorkLog.user_id == current_user.id,
            TaskWorkLog.deleted_at.is_(None),
        )
    )
    if not log:
        raise HTTPException(status_code=404, detail="日志不存在")
    if payload.content is not None:
        log.content = payload.content
    log.updated_at = utcnow()
    db.commit()
    db.refresh(log)
    return WorkLogResponse.model_validate(log)


@router.delete("/work-log/{log_id}")
def delete_work_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> dict:
    log = db.scalar(
        select(TaskWorkLog).where(
            TaskWorkLog.id == log_id,
            TaskWorkLog.user_id == current_user.id,
            TaskWorkLog.deleted_at.is_(None),
        )
    )
    if not log:
        raise HTTPException(status_code=404, detail="日志不存在")
    log.deleted_at = utcnow()
    db.commit()
    return {"ok": True}


@router.get("/work-logs", response_model=list[WorkLogResponse])
def list_work_logs(
    task_type: str | None = Query(default=None),
    task_id: int | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> list[WorkLogResponse]:
    query = select(TaskWorkLog).where(
        TaskWorkLog.user_id == current_user.id,
        TaskWorkLog.deleted_at.is_(None),
    )
    if task_type:
        query = query.where(TaskWorkLog.task_type == task_type)
    if task_id:
        query = query.where(TaskWorkLog.task_id == task_id)
    logs = db.scalars(query.order_by(TaskWorkLog.created_at.desc()).limit(limit)).all()
    return [WorkLogResponse.model_validate(log) for log in logs]


# ── 时长统计 ──

@router.get("/time-stats", response_model=TimeStatsResponse)
def get_time_stats(
    period: str = Query(default="day"),
    date_value: str | None = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_content_db),
) -> TimeStatsResponse:
    """获取日/周/月时长统计"""
    today = date.today()
    if date_value:
        today = date.fromisoformat(date_value)

    if period == "day":
        start = today
        end = today
    elif period == "week":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    elif period == "month":
        start = today.replace(day=1)
        if today.month == 12:
            end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
    else:
        start = today
        end = today

    # 查询已完成计时会话
    sessions = db.scalars(
        select(TaskTimerSession).where(
            TaskTimerSession.user_id == current_user.id,
            TaskTimerSession.status == "completed",
            func.date(TaskTimerSession.started_at) >= start,
            func.date(TaskTimerSession.started_at) <= end,
        )
    ).all()

    # 按任务聚合
    daily_task_stats: dict[int, TaskTimeStats] = {}
    range_task_stats: dict[int, TaskTimeStats] = {}
    category_stats: dict[int, TaskTimeStats] = {}

    for s in sessions:
        stats = TaskTimeStats(
            task_id=s.task_id,
            task_title="",
            task_type=s.task_type,
            total_seconds=s.actual_seconds,
            session_count=1,
        )
        if s.task_type == "daily_task":
            if s.task_id in daily_task_stats:
                daily_task_stats[s.task_id].total_seconds += s.actual_seconds
                daily_task_stats[s.task_id].session_count += 1
            else:
                daily_task_stats[s.task_id] = stats
        elif s.task_type == "range_reminder":
            if s.task_id in range_task_stats:
                range_task_stats[s.task_id].total_seconds += s.actual_seconds
                range_task_stats[s.task_id].session_count += 1
            else:
                range_task_stats[s.task_id] = stats
            # 按分类聚合
            reminder = db.get(RangeReminder, s.task_id)
            if reminder and reminder.category_id:
                cat = db.get(RangeTaskCategory, reminder.category_id)
                if cat:
                    if reminder.category_id in category_stats:
                        category_stats[reminder.category_id].total_seconds += s.actual_seconds
                        category_stats[reminder.category_id].session_count += 1
                    else:
                        category_stats[reminder.category_id] = TaskTimeStats(
                            task_id=cat.id,
                            task_title=cat.title,
                            task_type="range_reminder",
                            category_id=cat.id,
                            category_title=cat.title,
                            total_seconds=s.actual_seconds,
                            session_count=1,
                        )

    total = sum(s.actual_seconds for s in sessions)

    # 任务完成统计
    daily_completed = 0
    daily_total = 0
    range_completed = 0
    range_total = 0
    category_completions: list = []

    # 每日任务完成数
    daily_statuses = db.scalars(
        select(DailyTaskStatus).where(
            DailyTaskStatus.user_id == current_user.id,
            DailyTaskStatus.task_date >= start,
            DailyTaskStatus.task_date <= end,
            DailyTaskStatus.deleted_at.is_(None),
        )
    ).all()
    daily_completed = sum(1 for s in daily_statuses if s.completed)
    daily_total = len(daily_statuses)

    # 近期任务完成数（按分类聚合）
    range_reminders_all = db.scalars(
        select(RangeReminder).where(
            RangeReminder.user_id == current_user.id,
            RangeReminder.deleted_at.is_(None),
        )
    ).all()
    range_completed = sum(1 for r in range_reminders_all if r.status == "completed")
    range_total = len(range_reminders_all)

    # 按分类统计完成数
    cat_completed: dict[int, dict] = {}
    for r in range_reminders_all:
        cid = r.category_id or 0
        if cid not in cat_completed:
            cat = db.get(RangeTaskCategory, r.category_id) if r.category_id else None
            cat_completed[cid] = {
                "task_id": cid,
                "task_title": cat.title if cat else "未分类",
                "task_type": "range_reminder",
                "category_id": r.category_id,
                "category_title": cat.title if cat else None,
                "completed_count": 0,
                "total_count": 0,
            }
        cat_completed[cid]["total_count"] += 1
        if r.status == "completed":
            cat_completed[cid]["completed_count"] += 1

    category_completions = [
        TaskCompletionStats(**v) for v in cat_completed.values()
    ]

    # 为 range_reminders 填充子任务明细
    for stats in range_task_stats.values():
        reminder = db.get(RangeReminder, stats.task_id)
        if reminder:
            stats.task_title = reminder.title
            stats.category_id = reminder.category_id
            if reminder.category_id:
                cat = db.get(RangeTaskCategory, reminder.category_id)
                if cat:
                    stats.category_title = cat.title

    # 为 daily_tasks 填充标题
    for stats in daily_task_stats.values():
        template = db.get(DailyTaskTemplate, stats.task_id)
        if template:
            stats.task_title = template.title

    return TimeStatsResponse(
        period=period,
        start_date=start,
        end_date=end,
        daily_tasks=list(daily_task_stats.values()),
        range_reminders=list(range_task_stats.values()),
        range_categories=list(category_stats.values()),
        total_seconds=total,
        daily_completed=daily_completed,
        daily_total=daily_total,
        range_completed=range_completed,
        range_total=range_total,
        category_completions=category_completions,
    )
