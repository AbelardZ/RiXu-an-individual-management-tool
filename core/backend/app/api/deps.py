from pathlib import Path

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import content_session_for_workspace, get_db
from app.models.auth import User, UserRole, UserStorage
from app.services.auth import get_user_from_token
from app.services.storage import ensure_active_storage


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少认证信息")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="认证格式无效")
    return token


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    token = _extract_bearer_token(authorization)
    user = get_user_from_token(db, token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已失效")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return current_user


def get_current_storage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserStorage:
    return ensure_active_storage(db, current_user)


def get_content_db(
    storage: UserStorage = Depends(get_current_storage),
) -> Session:
    db = content_session_for_workspace(Path(storage.workspace_path))
    try:
        yield db
    finally:
        db.close()
