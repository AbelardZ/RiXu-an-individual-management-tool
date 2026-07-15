import json
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from app.core.config import PROJECT_ROOT, Settings, get_settings


UPLOAD_GROUPS = ("avatars", "records", "journals", "milestones")
CORE_TABLES = ("users", "user_profiles", "record_types", "records", "journal_entries", "milestone_days")


def initialize_workspace(settings: Settings | None = None) -> None:
    actual_settings = settings or get_settings()
    initialize_workspace_path(actual_settings.workspace_path, actual_settings.app_name)
    migrate_legacy_storage(actual_settings)


def initialize_workspace_path(workspace_path: Path, app_name: str = "DayOrder") -> None:
    workspace_path.mkdir(parents=True, exist_ok=True)
    (workspace_path / "exports").mkdir(parents=True, exist_ok=True)
    for group in UPLOAD_GROUPS:
        workspace_upload_dir(workspace_path, group).mkdir(parents=True, exist_ok=True)
    _ensure_workspace_config(workspace_path, app_name)


def upload_dir(settings: Settings, group: str) -> Path:
    return workspace_upload_dir(settings.workspace_path, group)


def workspace_upload_dir(workspace_path: Path, group: str) -> Path:
    if group not in UPLOAD_GROUPS:
        raise ValueError(f"unknown upload group: {group}")
    return workspace_path / "uploads" / group


def upload_url(group: str, filename: str, storage_id: int | None = None) -> str:
    if group not in UPLOAD_GROUPS:
        raise ValueError(f"unknown upload group: {group}")
    if storage_id:
        return f"/api/files/{storage_id}/{group}/{filename}"
    return f"/uploads/{group}/{filename}"


def path_from_public_url(url: str | None, settings: Settings | None = None) -> Path | None:
    if not url:
        return None
    actual_settings = settings or get_settings()
    if url.startswith("/uploads/"):
        relative_path = Path(url.removeprefix("/uploads/"))
        return actual_settings.uploads_dir / relative_path
    if url.startswith("/api/files/"):
        parts = Path(url.removeprefix("/api/files/")).parts
        if len(parts) >= 3:
            return actual_settings.uploads_dir / Path(*parts[1:])
    if url.startswith("/data/"):
        return PROJECT_ROOT / url.lstrip("/")
    return None


def path_from_storage_url(url: str | None, workspace_path: Path) -> Path | None:
    if not url:
        return None
    if url.startswith("/api/files/"):
        parts = Path(url.removeprefix("/api/files/")).parts
        if len(parts) >= 3:
            return workspace_path / "uploads" / Path(*parts[1:])
    if url.startswith("/uploads/"):
        return workspace_path / "uploads" / Path(url.removeprefix("/uploads/"))
    if url.startswith("/data/"):
        return PROJECT_ROOT / url.lstrip("/")
    return None


def unlink_public_file(url: str | None, settings: Settings | None = None) -> None:
    path = path_from_public_url(url, settings)
    if path and path.exists() and path.is_file():
        path.unlink()


def unlink_storage_file(url: str | None, workspace_path: Path) -> None:
    path = path_from_storage_url(url, workspace_path)
    if path and path.exists() and path.is_file():
        path.unlink()


def database_health(engine: Engine, settings: Settings | None = None) -> dict[str, Any]:
    actual_settings = settings or get_settings()
    result: dict[str, Any] = {
        "database_exists": actual_settings.sqlite_path.exists() if not actual_settings.database_url else None,
        "connectable": False,
        "core_tables_present": False,
        "missing_core_tables": list(CORE_TABLES),
        "workspace": str(actual_settings.workspace_path),
        "onedrive_workspace": is_onedrive_path(actual_settings.workspace_path),
    }
    try:
        if not actual_settings.database_url:
            with sqlite3.connect(actual_settings.sqlite_path) as connection:
                connection.execute("select 1")
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        missing = [name for name in CORE_TABLES if name not in table_names]
        result.update(
            {
                "connectable": True,
                "core_tables_present": not missing,
                "missing_core_tables": missing,
            }
        )
    except Exception as exc:  # pragma: no cover - health output should expose startup diagnostics.
        result["error"] = str(exc)
    if result["onedrive_workspace"]:
        result["onedrive_tip"] = "请将 DayOrderWorkspace 设置为“始终保留在此设备上”；同一时间尽量只在一台设备上打开 DayOrder。"
    return result


def migrate_legacy_storage(settings: Settings | None = None) -> None:
    actual_settings = settings or get_settings()
    if actual_settings.database_url:
        return
    legacy_db = PROJECT_ROOT / "backend" / "data" / "dayorder.db"
    if not actual_settings.sqlite_path.exists() and legacy_db.exists():
        shutil.copy2(legacy_db, actual_settings.sqlite_path)
    legacy_uploads = {
        PROJECT_ROOT / "data" / "avatars": upload_dir(actual_settings, "avatars"),
        PROJECT_ROOT / "data" / "milestone-backgrounds": upload_dir(actual_settings, "milestones"),
    }
    for source, target in legacy_uploads.items():
        if not source.exists():
            continue
        target.mkdir(parents=True, exist_ok=True)
        for file_path in source.iterdir():
            if file_path.is_file():
                destination = target / file_path.name
                if not destination.exists():
                    shutil.copy2(file_path, destination)


def is_onedrive_path(path: Path) -> bool:
    return any("onedrive" in part.lower() for part in path.resolve().parts)


def _ensure_workspace_config(workspace_path: Path, app_name: str = "DayOrder") -> None:
    config_path = workspace_path / "config.json"
    if config_path.exists():
        return
    payload = {
        "app": app_name,
        "workspace_version": 1,
        "database": "dayorder.db",
        "uploads": {group: f"uploads/{group}" for group in UPLOAD_GROUPS},
        "created_at": datetime.now().isoformat(timespec="seconds"),
    }
    config_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
