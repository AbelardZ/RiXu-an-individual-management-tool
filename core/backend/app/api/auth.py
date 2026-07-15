from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pathlib import Path
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.auth import User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterWithInviteRequest, TokenResponse, UserResponse
from app.services.bazi import BaziError
from app.services.auth import AuthError, authenticate_user, create_session, register_with_invitation, revoke_token
from app.services.cloud_auth import (
    clear_offline_credentials,
    clear_token_cache,
    create_access_token,
    create_refresh_token,
    has_offline_credentials,
    save_offline_credentials,
    save_token_cache,
    verify_offline_credentials,
    verify_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_response(db: Session, user: User) -> AuthResponse:
    token, session = create_session(db, user)
    db.refresh(user)
    return AuthResponse(access_token=token, expires_at=session.expires_at, user=UserResponse.model_validate(user))


def _cloud_auth_response(db: Session, user: User) -> dict:
    """云端认证响应：JWT access_token + refresh_token + 本地 session"""
    access_token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token(user.id, user.email)
    # 同时创建本地 session（兼容现有逻辑）
    local_token, session = create_session(db, user)
    # 缓存 token 到本地
    save_token_cache(access_token, refresh_token, user.email)
    db.refresh(user)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "local_token": local_token,
        "expires_at": session.expires_at.isoformat(),
        "user": UserResponse.model_validate(user).model_dump(),
    }


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterWithInviteRequest, request: Request, db: Session = Depends(get_db)) -> AuthResponse:
    """注册新用户。
    
    - 云端服务器（CLOUD_API_URL 为空）：直接验证邀请码并创建用户。
    - 客户端（CLOUD_API_URL 有值）：转发注册请求到云端。
    """
    from app.core.config import get_settings
    settings = get_settings()
    
    # 客户端模式：转发到云端
    if settings.cloud_api_url:
        import json
        import urllib.request
        import urllib.error
        
        cloud_register_url = f"{settings.cloud_api_url}/api/auth/register"
        body = json.dumps(payload.model_dump()).encode("utf-8")
        req = urllib.request.Request(cloud_register_url, data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        if request.client:
            req.add_header("X-Forwarded-For", request.client.host)
        
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            # 401/400 = 邀请码或参数问题，直接抛出
            if e.code in (400, 401):
                detail = "注册失败"
                try:
                    detail = json.loads(e.read()).get("detail", detail)
                except Exception:
                    pass
                raise HTTPException(status_code=e.code, detail=detail) from e
            # 其他错误 → 云端未就绪，降级本地注册
        except urllib.error.URLError:
            # 云端不可达 → 降级本地注册
            pass
        else:
            save_offline_credentials(str(payload.email), payload.password)
            return AuthResponse(
                access_token=result.get("access_token", ""),
                expires_at=result.get("expires_at", ""),
                user=result.get("user", {}),
            )
        
        # 降级：本地注册（云端不可用时）
        pass
    
    # 本地模式（或云端降级）：直接验证邀请码并创建用户
    try:
        user = register_with_invitation(
            db,
            payload,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except (AuthError, BaziError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    save_offline_credentials(str(payload.email), payload.password)
    return _auth_response(db, user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """登录。
    
    - 云端服务器（CLOUD_API_URL 为空）：直接验证密码。
    - 客户端（CLOUD_API_URL 有值）：转发到云端。
    """
    from app.core.config import get_settings
    settings = get_settings()
    
    # 客户端模式：转发到云端
    if settings.cloud_api_url:
        import json
        import urllib.request
        import urllib.error
        
        cloud_login_url = f"{settings.cloud_api_url}/api/auth/login/cloud"
        body = json.dumps(payload.model_dump()).encode("utf-8")
        req = urllib.request.Request(cloud_login_url, data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read())
            save_offline_credentials(str(payload.email), payload.password)
            return AuthResponse(
                access_token=result.get("local_token", result.get("access_token", "")),
                expires_at=result.get("expires_at", ""),
                user=result.get("user", {}),
            )
        except urllib.error.HTTPError as e:
            # 401 = 密码错误，直接抛出
            if e.code == 401:
                detail = "邮箱或密码不正确"
                try:
                    detail = json.loads(e.read()).get("detail", detail)
                except Exception:
                    pass
                raise HTTPException(status_code=401, detail=detail) from e
            # 其他错误（404/405/500）→ 云端未就绪，降级本地验证
        except urllib.error.URLError:
            # 云端不可达 → 降级本地验证
            pass
        
        # 降级：本地验证
        if verify_offline_credentials(str(payload.email), payload.password):
            from app.services.auth import get_user_by_email
            user = get_user_by_email(db, str(payload.email))
            if user:
                return _auth_response(db, user)
        
        # 尝试直接本地密码验证
        try:
            user = authenticate_user(db, str(payload.email), payload.password)
            save_offline_credentials(str(payload.email), payload.password)
            return _auth_response(db, user)
        except AuthError:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="无法连接云端服务器，且本地验证失败")
    
    # 云端模式：直接验证
    try:
        user = authenticate_user(db, str(payload.email), payload.password)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    save_offline_credentials(str(payload.email), payload.password)
    return _auth_response(db, user)


@router.post("/login/cloud")
def cloud_login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    """云端登录：返回 JWT token 对"""
    try:
        user = authenticate_user(db, str(payload.email), payload.password)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    save_offline_credentials(str(payload.email), payload.password)
    return _cloud_auth_response(db, user)


@router.post("/login/offline")
def offline_login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """离线登录：使用本地缓存的密码哈希验证"""
    if not verify_offline_credentials(str(payload.email), payload.password):
        # 降级：尝试正常登录
        try:
            user = authenticate_user(db, str(payload.email), payload.password)
            save_offline_credentials(str(payload.email), payload.password)
            return _auth_response(db, user)
        except AuthError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="离线凭据验证失败，请先在线登录一次") from exc
    # 离线验证通过，从本地数据库获取用户
    from app.services.auth import get_user_by_email
    user = get_user_by_email(db, str(payload.email))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    return _auth_response(db, user)


@router.post("/refresh")
def refresh_token(refresh_token: str = Header(alias="X-Refresh-Token")) -> dict:
    """刷新访问令牌"""
    payload = verify_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="刷新令牌无效或已过期")
    user_id = int(payload["sub"])
    email = payload["email"]
    new_access = create_access_token(user_id, email)
    new_refresh = create_refresh_token(user_id, email)
    save_token_cache(new_access, new_refresh, email)
    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
    }


@router.get("/offline-status")
def offline_status() -> dict:
    """检查是否有离线凭据"""
    return {
        "has_offline_credentials": has_offline_credentials(),
    }


def _browse_storage_directory() -> dict[str, str]:
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        selected = filedialog.askdirectory(title="选择日序存储目录")
        root.destroy()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="无法打开目录选择窗口，请手动输入路径") from exc
    if not selected:
        return {"path": ""}
    return {"path": str(Path(selected).expanduser().resolve())}


@router.get("/storage-directory/browse")
def browse_storage_directory_get() -> dict[str, str]:
    return _browse_storage_directory()


@router.post("/storage-directory/browse")
def browse_storage_directory() -> dict[str, str]:
    return _browse_storage_directory()


@router.post("/logout", response_model=dict[str, bool])
def logout(
    current_user: User = Depends(get_current_user),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    _ = current_user
    if authorization:
        revoke_token(db, authorization.removeprefix("Bearer ").removeprefix("bearer "))
    # 清除 token 缓存（但保留离线凭据以便下次离线登录）
    clear_token_cache()
    return {"ok": True}


@router.post("/logout/full", response_model=dict[str, bool])
def full_logout(
    current_user: User = Depends(get_current_user),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    """完全登出：清除所有缓存"""
    _ = current_user
    if authorization:
        revoke_token(db, authorization.removeprefix("Bearer ").removeprefix("bearer "))
    clear_token_cache()
    clear_offline_credentials()
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
