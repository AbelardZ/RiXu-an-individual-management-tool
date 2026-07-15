from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.models.auth import User, UserProfile
import json

from app.schemas.auth import ProfileCreate, ProfileUpdate
from app.services.bazi import calculate_bazi_json


class ProfileError(ValueError):
    pass


def _profile_create_from_model(profile: UserProfile) -> ProfileCreate:
    return ProfileCreate(
        nickname=profile.nickname,
        gender=profile.gender,
        birth_date=profile.birth_date,
        birth_time=profile.birth_time,
        birth_timezone=profile.birth_timezone,
        birth_place=profile.birth_place,
    )


def recalculate_profile_bazi(db: Session, user: User) -> UserProfile:
    if not user.profile:
        raise ProfileError("profile not found")
    status, result_json = calculate_bazi_json(_profile_create_from_model(user.profile))
    user.profile.bazi_status = status
    user.profile.bazi_result_json = result_json
    user.profile.updated_at = utcnow()
    db.commit()
    db.refresh(user.profile)
    return user.profile


def update_profile(db: Session, user: User, payload: ProfileUpdate) -> UserProfile:
    if not user.profile:
        raise ProfileError("profile not found")

    changed_birth_fields = False
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "weather_cities":
            user.profile.weather_cities_json = json.dumps(value, ensure_ascii=False) if value is not None else None
            continue
        setattr(user.profile, field, value)
        if field in {"birth_date", "birth_time", "birth_timezone", "birth_place"}:
            changed_birth_fields = True

    if changed_birth_fields:
        status, result_json = calculate_bazi_json(_profile_create_from_model(user.profile))
        user.profile.bazi_status = status
        user.profile.bazi_result_json = result_json

    user.profile.updated_at = utcnow()
    db.commit()
    db.refresh(user.profile)
    return user.profile
