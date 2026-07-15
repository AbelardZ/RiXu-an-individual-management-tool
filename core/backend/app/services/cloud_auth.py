"""
云端认证服务 — JWT Token 签发与验证

支持：
- 在线登录：邮箱+密码 → JWT access_token + refresh_token
- Token 刷新：refresh_token → 新 access_token
- 离线降级：本地缓存的密码哈希验证（网络不通时）
"""
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.core.security import store_password, verify_password, utcnow


# ── JWT 实现（无第三方依赖，纯 Python） ──

def _b64url_encode(data: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    import base64
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_jwt(payload: dict[str, Any], secret: str) -> str:
    """创建 JWT token"""
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url_encode(signature)}"


def decode_jwt(token: str, secret: str, verify_exp: bool = True) -> dict[str, Any] | None:
    """验证并解码 JWT token，失败返回 None"""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
        actual_sig = _b64url_decode(signature_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if verify_exp and payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


# ── 云端认证配置 ──

# JWT 密钥（生产环境应从环境变量读取）
import os

JWT_SECRET = os.environ.get("SECRET_KEY", "dayorder-cloud-jwt-secret-change-in-production")
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 小时
REFRESH_TOKEN_EXPIRE_DAYS = 30  # 30 天


def create_access_token(user_id: int, email: str) -> str:
    """创建访问令牌"""
    now = time.time()
    return create_jwt({
        "sub": str(user_id),
        "email": email,
        "iat": int(now),
        "exp": int(now + ACCESS_TOKEN_EXPIRE_MINUTES * 60),
        "type": "access",
    }, JWT_SECRET)


def create_refresh_token(user_id: int, email: str) -> str:
    """创建刷新令牌"""
    now = time.time()
    return create_jwt({
        "sub": str(user_id),
        "email": email,
        "iat": int(now),
        "exp": int(now + REFRESH_TOKEN_EXPIRE_DAYS * 86400),
        "type": "refresh",
    }, JWT_SECRET)


def verify_access_token(token: str) -> dict[str, Any] | None:
    """验证访问令牌"""
    payload = decode_jwt(token, JWT_SECRET, verify_exp=True)
    if payload and payload.get("type") == "access":
        return payload
    return None


def verify_refresh_token(token: str) -> dict[str, Any] | None:
    """验证刷新令牌"""
    payload = decode_jwt(token, JWT_SECRET, verify_exp=True)
    if payload and payload.get("type") == "refresh":
        return payload
    return None


# ── 离线凭据缓存 ──

def get_offline_credential_path() -> Path:
    """获取离线凭据缓存文件路径"""
    from app.core.config import get_settings
    settings = get_settings()
    return settings.workspace_path / ".offline_credentials"


def save_offline_credentials(email: str, password: str) -> None:
    """保存离线凭据（密码哈希）到本地文件"""
    creds = {
        "email": email,
        "password_hash": store_password(password),
        "updated_at": utcnow().isoformat(),
    }
    path = get_offline_credential_path()
    path.write_text(json.dumps(creds), encoding="utf-8")


def verify_offline_credentials(email: str, password: str) -> bool:
    """离线验证凭据"""
    path = get_offline_credential_path()
    if not path.exists():
        return False
    try:
        creds = json.loads(path.read_text(encoding="utf-8"))
        if creds.get("email") != email:
            return False
        return verify_password(password, creds.get("password_hash", ""))
    except (json.JSONDecodeError, KeyError):
        return False


def has_offline_credentials() -> bool:
    """检查是否有缓存的离线凭据"""
    return get_offline_credential_path().exists()


def get_cached_email() -> str | None:
    """获取缓存的邮箱"""
    path = get_offline_credential_path()
    if not path.exists():
        return None
    try:
        creds = json.loads(path.read_text(encoding="utf-8"))
        return creds.get("email")
    except (json.JSONDecodeError, KeyError):
        return None


def clear_offline_credentials() -> None:
    """清除离线凭据"""
    path = get_offline_credential_path()
    if path.exists():
        path.unlink()


# ── 本地 Token 缓存 ──

def get_token_cache_path() -> Path:
    from app.core.config import get_settings
    return get_settings().workspace_path / ".token_cache"


def save_token_cache(access_token: str, refresh_token: str, email: str) -> None:
    """缓存 token 到本地"""
    cache = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "email": email,
        "updated_at": utcnow().isoformat(),
    }
    get_token_cache_path().write_text(json.dumps(cache), encoding="utf-8")


def load_token_cache() -> dict[str, str] | None:
    """读取本地 token 缓存"""
    path = get_token_cache_path()
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, KeyError):
        return None


def clear_token_cache() -> None:
    """清除 token 缓存"""
    path = get_token_cache_path()
    if path.exists():
        path.unlink()
