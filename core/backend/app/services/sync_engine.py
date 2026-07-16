"""
同步引擎 — 本地 ↔ 云端双向同步

策略：
- 每张表维护 updated_at 和 sync_status 字段
- sync_status: 'local' | 'synced' | 'conflict'
- 在线时自动 push/pull
- 离线时标记为 'local'，恢复后批量 push
- 冲突策略：Last-Write-Wins (LWW)，基于 updated_at
"""
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import utcnow


# ── 同步状态 ──

class SyncStatus:
    LOCAL = "local"       # 仅本地有，待推送
    SYNCED = "synced"     # 已同步
    CONFLICT = "conflict" # 冲突，需手动解决


# ── 同步日志 ──

def get_sync_log_path() -> Path:
    from app.core.config import get_settings
    return get_settings().workspace_path / ".sync_log"


def log_sync_event(event: str, detail: str = "") -> None:
    """记录同步事件"""
    entry = {
        "time": utcnow().isoformat(),
        "event": event,
        "detail": detail,
    }
    path = get_sync_log_path()
    try:
        existing = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    except (json.JSONDecodeError, FileNotFoundError):
        existing = []
    existing.append(entry)
    # 只保留最近 200 条
    if len(existing) > 200:
        existing = existing[-200:]
    path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")


def get_sync_log() -> list[dict]:
    """获取同步日志"""
    path = get_sync_log_path()
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, FileNotFoundError):
        return []


# ── 变更追踪 ──

# 需要同步的表及其主键
SYNC_TABLES = {
    "tags": "id",
    "tag_links": "id",
    "record_types": "id",
    "records": "id",
    "journal_entries": "id",
    "daily_task_templates": "id",
    "range_task_categories": "id",
    "range_reminders": "id",
    "milestone_days": "id",
    "attachments": "id",
    "user_profiles": "user_id",
    "user_storages": "id",
}


def get_local_changes(db: Session, since: str | None = None) -> dict[str, list[dict]]:
    """获取本地未同步的变更"""
    changes = {}
    for table, pk in SYNC_TABLES.items():
        try:
            if since:
                rows = db.execute(
                    text(f"SELECT * FROM {table} WHERE updated_at > :since AND deleted_at IS NULL ORDER BY updated_at"),
                    {"since": since},
                ).fetchall()
            else:
                rows = db.execute(
                    text(f"SELECT * FROM {table} WHERE deleted_at IS NULL ORDER BY updated_at"),
                ).fetchall()
            if rows:
                changes[table] = [_row_to_dict(row) for row in rows]
        except Exception:
            continue
    return changes


def get_changes_since_last_sync(db: Session) -> dict[str, list[dict]]:
    """获取自上次同步以来的变更"""
    last_sync = _get_last_sync_time()
    return get_local_changes(db, since=last_sync)


def _row_to_dict(row) -> dict:
    """将 SQLAlchemy row 转为 dict，处理日期时间"""
    result = {}
    for key in row._mapping.keys():
        value = row._mapping[key]
        if isinstance(value, datetime):
            value = value.isoformat()
        result[key] = value
    return result


def _get_last_sync_time() -> str | None:
    """获取上次同步时间"""
    path = get_sync_log_path()
    if not path.exists():
        return None
    try:
        logs = json.loads(path.read_text(encoding="utf-8"))
        for entry in reversed(logs):
            if entry.get("event") in ("push_complete", "pull_complete"):
                return entry.get("time")
    except (json.JSONDecodeError, FileNotFoundError):
        pass
    return None


def mark_synced(db: Session, table: str, record_id: int) -> None:
    """标记记录为已同步"""
    try:
        db.execute(
            text(f"UPDATE {table} SET sync_status = 'synced' WHERE id = :id"),
            {"id": record_id},
        )
        db.commit()
    except Exception:
        db.rollback()


# ── 云端同步 API 客户端 ──

class CloudSyncClient:
    """云端同步 API 客户端"""

    def __init__(self, base_url: str, access_token: str):
        self.base_url = base_url.rstrip("/")
        self.access_token = access_token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    def push_changes(self, changes: dict[str, list[dict]]) -> dict:
        """推送本地变更到云端"""
        import urllib.request
        import urllib.error

        url = f"{self.base_url}/api/sync/push"
        data = json.dumps({"changes": changes, "client_time": utcnow().isoformat()}).encode()
        req = urllib.request.Request(url, data=data, headers=self._headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.URLError as e:
            log_sync_event("push_failed", str(e))
            raise SyncError(f"推送失败: {e}") from e

    def pull_changes(self, since: str | None = None) -> dict:
        """从云端拉取变更"""
        import urllib.request
        import urllib.error

        params = f"?since={since}" if since else ""
        url = f"{self.base_url}/api/sync/pull{params}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.URLError as e:
            log_sync_event("pull_failed", str(e))
            raise SyncError(f"拉取失败: {e}") from e

    def check_connectivity(self) -> bool:
        """检查云端是否可达"""
        import urllib.request
        import urllib.error

        url = f"{self.base_url}/api/health"
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200
        except Exception:
            return False


class SyncError(Exception):
    pass


# ── 同步协调器 ──

def is_online() -> bool:
    """检查网络是否在线。
    
    检测顺序：
    1. 环境变量 HEALTH_CHECK_URL 指定的地址
    2. 云端 API 的 /api/health 端点
    3. 百度（国内默认）
    """
    import os
    import urllib.request
    import urllib.error

    # 可配置的健康检查 URL
    health_urls = []
    custom_url = os.environ.get("HEALTH_CHECK_URL", "")
    if custom_url:
        health_urls.append(custom_url)
    
    # 云端 API
    from app.core.config import get_settings
    settings = get_settings()
    cloud_url = getattr(settings, 'cloud_api_url', None)
    if cloud_url:
        health_urls.append(f"{cloud_url}/api/health")
    
    # 兜底：百度
    health_urls.append("https://www.baidu.com")
    
    for url in health_urls:
        try:
            req = urllib.request.Request(url, method="HEAD" if not url.endswith("/api/health") else "GET")
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status in (200, 301, 302):
                    return True
        except Exception:
            continue
    return False


def apply_remote_changes(db: Session, changes: dict[str, list[dict]]) -> int:
    """将云端变更应用到本地数据库（LWW 策略）"""
    applied = 0
    for table, records in changes.items():
        if table not in SYNC_TABLES:
            continue
        pk = SYNC_TABLES[table]
        for record in records:
            try:
                record_id = record.get(pk)
                if not record_id:
                    continue
                remote_updated = record.get("updated_at", "")
                # 检查本地版本
                existing = db.execute(
                    text(f"SELECT updated_at FROM {table} WHERE {pk} = :id"),
                    {"id": record_id},
                ).fetchone()
                if existing:
                    local_updated = existing[0]
                    if isinstance(local_updated, datetime):
                        local_updated = local_updated.isoformat()
                    # LWW: 保留更新时间更晚的版本
                    if str(local_updated) >= str(remote_updated):
                        continue
                    # 更新本地
                    set_clauses = ", ".join(
                        f"{k} = :{k}" for k in record.keys() if k != pk
                    )
                    if set_clauses:
                        params = {k: v for k, v in record.items()}
                        db.execute(
                            text(f"UPDATE {table} SET {set_clauses} WHERE {pk} = :{pk}"),
                            params,
                        )
                else:
                    # 新记录，插入
                    columns = ", ".join(record.keys())
                    placeholders = ", ".join(f":{k}" for k in record.keys())
                    db.execute(
                        text(f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"),
                        record,
                    )
                applied += 1
            except Exception:
                db.rollback()
                continue
    db.commit()
    return applied


def run_sync(db: Session, cloud_url: str, access_token: str) -> dict:
    """执行一次完整的同步周期"""
    result = {
        "status": "offline",
        "pushed": 0,
        "pulled": 0,
        "message": "",
    }

    if not is_online():
        result["message"] = "离线模式，变更已保存在本地"
        log_sync_event("sync_skipped", "offline")
        return result

    client = CloudSyncClient(cloud_url, access_token)
    if not client.check_connectivity():
        result["message"] = "云端不可达，变更已保存在本地"
        log_sync_event("sync_skipped", "cloud_unreachable")
        return result

    try:
        # 1. 推送本地变更
        local_changes = get_changes_since_last_sync(db)
        if any(local_changes.values()):
            push_result = client.push_changes(local_changes)
            result["pushed"] = push_result.get("applied", 0)
            log_sync_event("push_complete", f"pushed {result['pushed']} records")

        # 2. 拉取云端变更
        last_sync = _get_last_sync_time()
        pull_result = client.pull_changes(since=last_sync)
        remote_changes = pull_result.get("changes", {})
        if any(remote_changes.values()):
            result["pulled"] = apply_remote_changes(db, remote_changes)
            log_sync_event("pull_complete", f"pulled {result['pulled']} records")

        result["status"] = "synced"
        result["message"] = f"同步完成：推送 {result['pushed']} 条，拉取 {result['pulled']} 条"
    except SyncError as e:
        result["status"] = "error"
        result["message"] = str(e)
        log_sync_event("sync_error", str(e))

    return result
