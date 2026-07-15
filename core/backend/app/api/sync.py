"""
云端同步 API — 接收客户端推送、响应拉取请求
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.auth import User
from app.services.cloud_auth import verify_access_token
from app.services.sync_engine import apply_remote_changes, get_local_changes

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/push")
def push_changes(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """接收客户端推送的变更"""
    changes = payload.get("changes", {})
    if not changes:
        return {"status": "ok", "applied": 0}

    try:
        applied = apply_remote_changes(db, changes)
        return {"status": "ok", "applied": applied}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e


@router.get("/pull")
def pull_changes(
    since: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """响应客户端拉取请求"""
    try:
        changes = get_local_changes(db, since=since)
        return {"status": "ok", "changes": changes, "server_time": __import__("app.core.security", fromlist=["utcnow"]).utcnow().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e


@router.get("/status")
def sync_status(
    current_user: User = Depends(get_current_user),
) -> dict:
    """获取同步状态"""
    from app.services.sync_engine import get_sync_log, is_online
    return {
        "online": is_online(),
        "last_sync_log": get_sync_log()[-5:] if get_sync_log() else [],
    }
