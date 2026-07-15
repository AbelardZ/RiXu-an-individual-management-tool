import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.api.deps import get_content_db, get_current_storage, get_current_user
from app.core.database import get_db
from app.models.auth import User, UserStorage
from app.models.content import Attachment
from app.schemas.auth import ProfileUpdate, StorageCreateRequest, StorageSwitchRequest, UserProfileResponse, UserStorageListResponse
from app.services.bazi import BaziError
from app.services.users import ProfileError, recalculate_profile_bazi, update_profile
from app.services.storage import StorageError, list_user_storages, storage_response, switch_active_storage, update_active_storage
from app.core.workspace import unlink_storage_file, upload_url, workspace_upload_dir

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/profile", response_model=UserProfileResponse)
def my_profile(current_user: User = Depends(get_current_user)) -> UserProfileResponse:
    return UserProfileResponse.from_profile(current_user.profile)


@router.patch("/me/profile", response_model=UserProfileResponse)
def patch_my_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    try:
        profile = update_profile(db, current_user, payload)
    except (ProfileError, BaziError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return UserProfileResponse.from_profile(profile)


@router.post("/me/avatar", response_model=UserProfileResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    identity_db: Session = Depends(get_db),
    content_db: Session = Depends(get_content_db),
    storage: UserStorage = Depends(get_current_storage),
) -> UserProfileResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只支持图片文件")
    ext = os.path.splitext(file.filename or "avatar.png")[1] or ".png"
    if ext.lower() not in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        raise HTTPException(status_code=400, detail="不支持的图片格式")
    workspace_path = Path(storage.workspace_path)
    target_dir = workspace_upload_dir(workspace_path, "avatars")
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = target_dir / filename
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片不能超过 5MB")
    filepath.write_bytes(content)
    avatar_url = upload_url("avatars", filename, storage.id)
    # 删除旧头像文件
    old_avatar = current_user.profile.avatar_url if current_user.profile else None
    unlink_storage_file(old_avatar, workspace_path)
    profile = update_profile(identity_db, current_user, ProfileUpdate(avatar_url=avatar_url))
    content_db.add(
        Attachment(
            owner_type="avatar",
            owner_id=current_user.id,
            file_name=file.filename or filename,
            file_path=avatar_url,
            mime_type=file.content_type,
            size=len(content),
        )
    )
    content_db.commit()
    return UserProfileResponse.from_profile(profile)


@router.get("/me/storages", response_model=UserStorageListResponse)
def my_storages(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserStorageListResponse:
    items = list_user_storages(db, current_user)
    return UserStorageListResponse(
        active_storage_id=current_user.active_storage_id,
        storages=[storage_response(item, current_user.active_storage_id) for item in items],
    )


@router.post("/me/storages", response_model=UserStorageListResponse, status_code=status.HTTP_201_CREATED)
def create_my_storage(
    payload: StorageCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserStorageListResponse:
    update_active_storage(db, current_user, payload)
    db.refresh(current_user)
    items = list_user_storages(db, current_user)
    return UserStorageListResponse(
        active_storage_id=current_user.active_storage_id,
        storages=[storage_response(item, current_user.active_storage_id) for item in items],
    )


@router.patch("/me/storages/current", response_model=UserStorageListResponse)
def update_my_current_storage(
    payload: StorageCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserStorageListResponse:
    update_active_storage(db, current_user, payload)
    db.refresh(current_user)
    items = list_user_storages(db, current_user)
    return UserStorageListResponse(
        active_storage_id=current_user.active_storage_id,
        storages=[storage_response(item, current_user.active_storage_id) for item in items],
    )


@router.patch("/me/storages/active", response_model=UserStorageListResponse)
def switch_my_storage(
    payload: StorageSwitchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserStorageListResponse:
    try:
        switch_active_storage(db, current_user, payload.storage_id)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    db.refresh(current_user)
    items = list_user_storages(db, current_user)
    return UserStorageListResponse(
        active_storage_id=current_user.active_storage_id,
        storages=[storage_response(item, current_user.active_storage_id) for item in items],
    )


@router.post("/me/recalculate-bazi", response_model=UserProfileResponse)
def recalculate_my_bazi(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    try:
        profile = recalculate_profile_bazi(db, current_user)
    except (ProfileError, BaziError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return UserProfileResponse.from_profile(profile)
