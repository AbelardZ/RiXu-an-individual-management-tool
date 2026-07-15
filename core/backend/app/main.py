from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.api import auth, backup, calendar, deploy_api, journals, records, reminders, sync, tags, tasks, users
from app.core.config import get_settings
from app.core.database import engine, get_db, init_db
from app.core.workspace import UPLOAD_GROUPS, database_health
from app.models.auth import UserStorage


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

# ── CORS 中间件 ──
# 本地开发时允许所有来源；云端部署时通过环境变量 CORS_ORIGINS 限制
_cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins if o.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(records.router, prefix="/api")
app.include_router(journals.router, prefix="/api")
app.include_router(reminders.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(sync.router, prefix="/api")
app.include_router(backup.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(deploy_api.router, prefix="/api")

@app.get("/api/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "app": settings.app_name,
        "workspace": database_health(engine, settings),
    }


@app.get("/api/files/{storage_id}/{group}/{filename}")
def get_storage_file(storage_id: int, group: str, filename: str, db: Session = Depends(get_db)) -> FileResponse:
    if group not in UPLOAD_GROUPS or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=404, detail="file not found")
    storage = db.get(UserStorage, storage_id)
    if not storage or storage.deleted_at:
        raise HTTPException(status_code=404, detail="file not found")
    path = Path(storage.workspace_path) / "uploads" / group / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(path)


frontend_dir = Path(os.environ.get("DAYORDER_FRONTEND_DIR", Path(__file__).resolve().parents[2] / "frontend"))
data_dir = Path(os.environ.get("DAYORDER_DATA_DIR", Path(__file__).resolve().parents[2] / "data"))
uploads_dir = settings.uploads_dir
if uploads_dir.exists():
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
if data_dir.exists():
    app.mount("/data", StaticFiles(directory=data_dir), name="data")
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
