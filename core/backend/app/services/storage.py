from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import init_content_database
from app.core.security import utcnow
from app.models.auth import User, UserStorage
from app.schemas.auth import StorageCreateRequest, UserStorageResponse


class StorageError(ValueError):
    pass


def list_user_storages(db: Session, user: User) -> list[UserStorage]:
    return list(
        db.scalars(
            select(UserStorage)
            .where(UserStorage.user_id == user.id, UserStorage.deleted_at.is_(None))
            .order_by(UserStorage.created_at.asc(), UserStorage.id.asc())
        ).all()
    )


def ensure_active_storage(db: Session, user: User) -> UserStorage:
    storages = list_user_storages(db, user)
    active = next((item for item in storages if item.id == user.active_storage_id), None)
    if active:
        init_content_database(Path(active.workspace_path))
        return active
    if storages:
        user.active_storage_id = storages[0].id
        db.commit()
        init_content_database(Path(storages[0].workspace_path))
        return storages[0]
    return create_storage(db, user, StorageCreateRequest(name="默认存储", workspace_path=str(get_settings().workspace_path)), activate=True)


def create_storage(db: Session, user: User, payload: StorageCreateRequest, *, activate: bool = False) -> UserStorage:
    settings = get_settings()
    name = (payload.name or "新存储").strip() or "新存储"
    workspace_path = _resolve_workspace_path(payload.workspace_path, user.id, name)
    storage = UserStorage(
        user_id=user.id,
        name=name,
        workspace_path=str(workspace_path),
        is_initialized=1,
    )
    db.add(storage)
    db.flush()
    if not _is_identity_workspace(workspace_path):
        init_content_database(workspace_path)
    if activate:
        user.active_storage_id = storage.id
    db.commit()
    db.refresh(storage)
    _ = settings
    return storage


def create_registration_storage(db: Session, user: User, *, name: str | None = None, workspace_path: str | None = None) -> UserStorage:
    target_workspace = workspace_path or str(get_settings().workspace_path)
    return create_storage(
        db,
        user,
        StorageCreateRequest(name=name or "默认存储", workspace_path=target_workspace),
        activate=True,
    )


def update_active_storage(db: Session, user: User, payload: StorageCreateRequest) -> UserStorage:
    storage = ensure_active_storage(db, user)
    name = (payload.name or storage.name or "默认存储").strip() or "默认存储"
    workspace_path = _resolve_workspace_path(payload.workspace_path, user.id, name)
    if not _is_identity_workspace(workspace_path):
        init_content_database(workspace_path)
    storage.name = name
    storage.workspace_path = str(workspace_path)
    storage.is_initialized = 1
    storage.updated_at = utcnow()
    user.active_storage_id = storage.id
    user.updated_at = utcnow()
    db.commit()
    db.refresh(user)
    db.refresh(storage)
    return storage


def switch_active_storage(db: Session, user: User, storage_id: int) -> UserStorage:
    storage = db.scalar(
        select(UserStorage).where(
            UserStorage.id == storage_id,
            UserStorage.user_id == user.id,
            UserStorage.deleted_at.is_(None),
        )
    )
    if not storage:
        raise StorageError("存储位置不存在")
    init_content_database(Path(storage.workspace_path))
    user.active_storage_id = storage.id
    user.updated_at = utcnow()
    db.commit()
    db.refresh(user)
    db.refresh(storage)
    return storage


def storage_response(item: UserStorage, active_storage_id: int | None) -> UserStorageResponse:
    data = UserStorageResponse.model_validate(item).model_dump()
    data["active"] = item.id == active_storage_id
    return UserStorageResponse(**data)


def _resolve_workspace_path(value: str | None, user_id: int, name: str) -> Path:
    if value and value.strip():
        return Path(value.strip()).expanduser().resolve()
    slug = _safe_slug(name)
    stamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return (get_settings().workspace_path / "accounts" / f"user-{user_id}" / f"{slug}-{stamp}").resolve()


def _is_identity_workspace(workspace_path: Path) -> bool:
    return (workspace_path / "dayorder.db").resolve() == get_settings().sqlite_path.resolve()


def _safe_slug(value: str) -> str:
    chars = [char.lower() if char.isalnum() else "-" for char in value.strip()]
    slug = "".join(chars).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or "storage"
