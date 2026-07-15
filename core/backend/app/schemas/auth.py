import json
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


GenderValue = Literal["male", "female", "other", "unspecified"]
RoleValue = Literal["admin", "user"]


class ProfileCreate(BaseModel):
    nickname: str = Field(min_length=1, max_length=80)
    gender: GenderValue = "unspecified"
    birth_date: date
    birth_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    birth_timezone: str = Field(default="Asia/Shanghai", max_length=64)
    birth_place: str | None = Field(default=None, max_length=160)


class ProfileUpdate(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=80)
    gender: GenderValue | None = None
    birth_date: date | None = None
    birth_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    birth_timezone: str | None = Field(default=None, max_length=64)
    birth_place: str | None = Field(default=None, max_length=160)
    avatar_url: str | None = Field(default=None, max_length=512)
    signature: str | None = Field(default=None, max_length=200)
    weather_cities: list[str] | None = None


class RegisterWithInviteRequest(BaseModel):
    """注册请求：只需邮箱+密码+邀请码，身份信息可选（引导页填写）"""
    invitation_code: str = Field(min_length=1, max_length=128)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    # 身份信息（可选，引导页会更新）
    nickname: str = Field(default="新用户", max_length=80)
    gender: GenderValue = "unspecified"
    birth_date: date | None = None
    birth_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    birth_timezone: str = Field(default="Asia/Shanghai", max_length=64)
    birth_place: str | None = Field(default=None, max_length=160)
    # 工作区
    storage_name: str | None = Field(default=None, max_length=120)
    storage_path: str | None = Field(default=None, max_length=1024)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("invalid email")
        return normalized


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("invalid email")
        return normalized


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nickname: str
    gender: str
    birth_date: date
    birth_time: str
    birth_timezone: str
    birth_place: str | None
    avatar_url: str | None = None
    signature: str | None = None
    bazi_status: str
    bazi_result_json: str | None
    bazi_result: dict | None = None
    weather_cities: list[str] = []

    @field_validator("bazi_result", mode="before")
    @classmethod
    def keep_bazi_result(cls, value: dict | None) -> dict | None:
        return value

    @classmethod
    def from_profile(cls, profile) -> "UserProfileResponse":
        data = cls.model_validate(profile).model_dump()
        if profile.bazi_result_json:
            data["bazi_result"] = json.loads(profile.bazi_result_json)
        if profile.weather_cities_json:
            try:
                data["weather_cities"] = json.loads(profile.weather_cities_json)
            except (json.JSONDecodeError, TypeError):
                data["weather_cities"] = []
        return cls(**data)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str
    status: str
    created_at: datetime
    active_storage_id: int | None = None
    profile: UserProfileResponse | None = None


class AuthResponse(TokenResponse):
    user: UserResponse


class InvitationCreateRequest(BaseModel):
    assigned_email: str | None = Field(default=None, max_length=320)
    role: RoleValue = "user"
    max_uses: int = Field(default=1, ge=1, le=100)
    expires_at: datetime | None = None

    @field_validator("assigned_email")
    @classmethod
    def validate_assigned_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("invalid email")
        return normalized


class InvitationCreateResponse(BaseModel):
    id: int
    code: str
    assigned_email: str | None
    role: str
    max_uses: int
    expires_at: datetime | None


class StorageCreateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    workspace_path: str | None = Field(default=None, max_length=1024)


class StorageSwitchRequest(BaseModel):
    storage_id: int


class UserStorageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    workspace_path: str
    is_initialized: bool
    created_at: datetime
    updated_at: datetime
    active: bool = False


class UserStorageListResponse(BaseModel):
    active_storage_id: int | None = None
    storages: list[UserStorageResponse]


class InvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assigned_email: str | None
    role: str
    max_uses: int
    used_count: int
    expires_at: datetime | None
    created_at: datetime
    disabled_at: datetime | None
