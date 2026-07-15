"""
备份导出 API
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.models.auth import User
from app.services.backup import (
    auto_backup,
    export_as_json,
    export_as_sqlite,
    export_full_package,
    get_backup_status,
    get_export_status,
    open_backups_folder,
    open_exports_folder,
    open_workspace_folder,
)

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("/status")
def backup_status(current_user: User = Depends(get_current_user)) -> dict:
    """获取备份和导出状态"""
    return {
        "backup": get_backup_status(),
        "export": get_export_status(),
    }


@router.post("/auto")
def trigger_auto_backup(current_user: User = Depends(get_current_user)) -> dict:
    """触发自动备份"""
    path = auto_backup()
    if path:
        return {"status": "ok", "path": str(path), "name": path.name}
    return {"status": "skipped", "message": "数据库为空或不存在"}


@router.post("/export/json")
def trigger_export_json(current_user: User = Depends(get_current_user)) -> dict:
    """导出为 JSON"""
    try:
        path = export_as_json()
        return {"status": "ok", "path": str(path), "name": path.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/export/sqlite")
def trigger_export_sqlite(current_user: User = Depends(get_current_user)) -> dict:
    """导出为 SQLite 副本"""
    try:
        path = export_as_sqlite()
        return {"status": "ok", "path": str(path), "name": path.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/export/full")
def trigger_export_full(current_user: User = Depends(get_current_user)) -> dict:
    """导出完整数据包 (ZIP)"""
    try:
        path = export_full_package()
        return {"status": "ok", "path": str(path), "name": path.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/download/{filename}")
def download_export(filename: str, current_user: User = Depends(get_current_user)) -> FileResponse:
    """下载导出文件"""
    from app.core.config import get_settings
    export_dir = get_settings().workspace_path / "exports"
    file_path = export_dir / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(file_path, filename=filename)


@router.post("/open/workspace")
def open_workspace(current_user: User = Depends(get_current_user)) -> dict:
    """在文件管理器中打开工作区"""
    ok = open_workspace_folder()
    return {"ok": ok}


@router.post("/open/backups")
def open_backups(current_user: User = Depends(get_current_user)) -> dict:
    """在文件管理器中打开备份目录"""
    ok = open_backups_folder()
    return {"ok": ok}


@router.post("/open/exports")
def open_exports(current_user: User = Depends(get_current_user)) -> dict:
    """在文件管理器中打开导出目录"""
    ok = open_exports_folder()
    return {"ok": ok}
