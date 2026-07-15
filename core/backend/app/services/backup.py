"""
备份导出服务 — 本地数据备份、导出、一键打开

功能：
- 自动备份：每次启动时备份 SQLite 数据库
- 手动导出：导出为 JSON 或 SQLite 文件
- 一键打开：在文件管理器中打开工作区/备份目录
"""
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.security import utcnow


def get_workspace_dir() -> Path:
    from app.core.config import get_settings
    return get_settings().workspace_path


def get_db_path() -> Path:
    from app.core.config import get_settings
    return get_settings().sqlite_path


# ── 自动备份 ──

def auto_backup() -> Path | None:
    """自动备份数据库（已禁用——本地只有一份数据，云端是权威源）"""
    return None
def auto_backup() -> Path | None:
    """自动备份数据库（已禁用——本地只有一份数据，云端是权威源）"""
    return None


# ── 手动导出 ──

def export_as_json(output_path: Path | None = None) -> Path:
    """导出所有数据为 JSON 文件"""
    db_path = get_db_path()
    if not db_path.exists():
        raise FileNotFoundError("数据库文件不存在")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 获取所有表
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'alembic_%'")
    tables = [row[0] for row in cursor.fetchall()]

    export_data: dict[str, list[dict]] = {}
    for table in tables:
        try:
            cursor.execute(f"SELECT * FROM {table} WHERE deleted_at IS NULL")
            rows = [dict(row) for row in cursor.fetchall()]
            # 转换日期时间为字符串
            for row in rows:
                for key, value in row.items():
                    if isinstance(value, datetime):
                        row[key] = value.isoformat()
            export_data[table] = rows
        except Exception:
            continue

    conn.close()

    # 添加元数据
    export = {
        "app": "DayOrder",
        "exported_at": utcnow().isoformat(),
        "version": "1.0",
        "data": export_data,
    }

    if output_path is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_dir = get_workspace_dir() / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)
        output_path = export_dir / f"dayorder_export_{timestamp}.json"

    output_path.write_text(json.dumps(export, ensure_ascii=False, indent=2), encoding="utf-8")
    return output_path


def export_as_sqlite(output_path: Path | None = None) -> Path:
    """导出数据库副本"""
    db_path = get_db_path()
    if not db_path.exists():
        raise FileNotFoundError("数据库文件不存在")

    if output_path is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_dir = get_workspace_dir() / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)
        output_path = export_dir / f"dayorder_export_{timestamp}.db"

    shutil.copy2(db_path, output_path)
    return output_path


def export_full_package(output_path: Path | None = None) -> Path:
    """导出完整数据包（数据库 + 上传文件）为 ZIP"""
    workspace = get_workspace_dir()
    db_path = get_db_path()

    if output_path is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_dir = workspace / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)
        output_path = export_dir / f"dayorder_full_{timestamp}.zip"

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # 添加数据库
        if db_path.exists():
            zf.write(db_path, "dayorder.db")

        # 添加上传文件
        uploads_dir = workspace / "uploads"
        if uploads_dir.exists():
            for file in uploads_dir.rglob("*"):
                if file.is_file():
                    arcname = str(file.relative_to(workspace))
                    zf.write(file, arcname)

        # 添加配置文件
        config_path = workspace / "config.json"
        if config_path.exists():
            zf.write(config_path, "config.json")

    return output_path


# ── 一键打开 ──

def open_in_explorer(path: Path) -> bool:
    """在文件管理器中打开路径"""
    try:
        if sys.platform == "win32":
            os.startfile(str(path))
        elif sys.platform == "darwin":
            subprocess.run(["open", str(path)], check=True)
        else:
            subprocess.run(["xdg-open", str(path)], check=True)
        return True
    except Exception:
        return False


def open_workspace_folder() -> bool:
    """打开工作区文件夹"""
    return open_in_explorer(get_workspace_dir())


def open_backups_folder() -> bool:
    """打开本地缓存目录"""
    return open_in_explorer(get_workspace_dir())


def open_exports_folder() -> bool:
    """打开导出文件夹"""
    export_dir = get_workspace_dir() / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    return open_in_explorer(export_dir)


# ── 备份状态 ──

def get_backup_status() -> dict[str, Any]:
    """获取备份状态信息"""
    backup_dir = get_backup_dir()
    db_path = get_db_path()

    backups = []
    if backup_dir.exists():
        for f in sorted(backup_dir.glob("dayorder_auto_*.db"), reverse=True):
            backups.append({
                "name": f.name,
                "size": f.stat().st_size,
                "time": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            })

    return {
        "db_size": db_path.stat().st_size if db_path.exists() else 0,
        "db_updated": datetime.fromtimestamp(db_path.stat().st_mtime).isoformat() if db_path.exists() else None,
        "backup_count": len(backups),
        "latest_backup": backups[0] if backups else None,
        "backups": backups[:10],  # 最近 10 个
    }


def get_export_status() -> dict[str, Any]:
    """获取导出状态"""
    export_dir = get_workspace_dir() / "exports"
    exports = []
    if export_dir.exists():
        for f in sorted(export_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
            if f.is_file():
                exports.append({
                    "name": f.name,
                    "size": f.stat().st_size,
                    "time": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                })

    return {
        "export_count": len(exports),
        "latest_export": exports[0] if exports else None,
        "exports": exports[:10],
    }
