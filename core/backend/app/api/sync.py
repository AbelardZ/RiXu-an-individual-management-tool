"""
云端同步 API — 接收客户端推送、响应拉取请求

客户端模式（CLOUD_API_URL 有值）：转发到云端
云端模式（CLOUD_API_URL 为空）：直接处理
"""
import json
import urllib.request
import urllib.error

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.auth import User
from app.services.cloud_auth import verify_access_token
from app.services.sync_engine import apply_remote_changes, get_local_changes

router = APIRouter(prefix="/sync", tags=["sync"])


def _forward_to_cloud(path: str, payload: dict | None = None, method: str = "GET") -> dict | None:
    """客户端模式：转发请求到云端"""
    settings = get_settings()
    if not settings.cloud_api_url:
        return None
    url = f"{settings.cloud_api_url}/api/sync{path}"
    try:
        data = json.dumps(payload).encode("utf-8") if payload else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception:
        return None


@router.post("/push")
def push_changes(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """接收客户端推送的变更"""
    # 客户端模式：转发到云端
    cloud_result = _forward_to_cloud("/push", payload, "POST")
    if cloud_result:
        return cloud_result

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
    # 客户端模式：转发到云端
    cloud_result = _forward_to_cloud(f"/pull?since={since or ''}", method="GET")
    if cloud_result:
        return cloud_result

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
