from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import expires_after, hash_secret, is_password_hash, make_random_token, store_password, token_lookup_hash, utcnow, verify_password, verify_secret
from app.models.auth import AuthSession, User, UserProfile, UserRole, UserStatus
from app.schemas.auth import ProfileCreate, RegisterWithInviteRequest
from app.services.bazi import calculate_bazi_json
from app.services.storage import create_registration_storage


class AuthError(ValueError):
    pass


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email), User.deleted_at.is_(None)))


def create_session(db: Session, user: User) -> tuple[str, AuthSession]:
    settings = get_settings()
    token = make_random_token()
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_secret(token),
        token_lookup_hash=token_lookup_hash(token),
        expires_at=expires_after(settings.session_expire_days),
    )
    user.last_login_at = utcnow()
    db.add(session)
    db.commit()
    db.refresh(session)
    return token, session


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        raise AuthError("邮箱或密码不正确")
    if user.status != UserStatus.active.value:
        raise AuthError("账号不可用")
    if not is_password_hash(user.password_hash):
        user.password_hash = store_password(password)
        user.updated_at = utcnow()
        db.commit()
    return user


def get_user_from_token(db: Session, token: str) -> User | None:
    lookup_hash = token_lookup_hash(token)
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_lookup_hash == lookup_hash,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > utcnow(),
        )
    )
    if session:
        return db.get(User, session.user_id)

    rows = db.scalars(
        select(AuthSession).where(
            AuthSession.token_lookup_hash.is_(None),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > utcnow(),
        )
    ).all()
    for session in rows:
        if verify_secret(token, session.token_hash):
            session.token_lookup_hash = lookup_hash
            db.commit()
            return db.get(User, session.user_id)
    return None


def revoke_token(db: Session, token: str) -> None:
    lookup_hash = token_lookup_hash(token)
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_lookup_hash == lookup_hash,
            AuthSession.revoked_at.is_(None),
        )
    )
    if session:
        session.revoked_at = utcnow()
        db.commit()
        return

    rows = db.scalars(select(AuthSession).where(AuthSession.token_lookup_hash.is_(None), AuthSession.revoked_at.is_(None))).all()
    for session in rows:
        if verify_secret(token, session.token_hash):
            session.token_lookup_hash = lookup_hash
            session.revoked_at = utcnow()
            db.commit()
            return


def register_with_invitation(
    db: Session,
    payload: RegisterWithInviteRequest,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> User:
    email = normalize_email(str(payload.email))
    if get_user_by_email(db, email):
        raise AuthError("该邮箱已注册")

    # ── 邀请码校验 ──
    from app.models.auth import InvitationCode, InvitationUse
    from app.core.security import hash_secret

    if not payload.invitation_code:
        raise AuthError("需要邀请码才能注册")

    # 查找有效邀请码（hash 匹配）
    invitation = None
    all_codes = db.scalars(
        select(InvitationCode).where(
            InvitationCode.disabled_at.is_(None),
        )
    ).all()
    for code in all_codes:
        from app.core.security import verify_secret
        if verify_secret(payload.invitation_code, code.code_hash):
            invitation = code
            break

    if not invitation:
        raise AuthError("邀请码无效")

    # 检查是否过期
    if invitation.expires_at and invitation.expires_at < utcnow():
        raise AuthError("邀请码已过期")

    # 检查使用次数
    if invitation.max_uses > 0 and invitation.used_count >= invitation.max_uses:
        raise AuthError("邀请码已达使用上限")

    # 检查指定邮箱
    if invitation.assigned_email and normalize_email(invitation.assigned_email) != email:
        raise AuthError("此邀请码不适用于该邮箱")

    # 记录使用
    invite_use = InvitationUse(
        invitation_id=invitation.id,
        used_email=email,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(invite_use)
    invitation.used_count += 1
    # ── 邀请码校验结束 ──

    # 构建 profile
    nickname = payload.nickname or email.split("@")[0]
    birth_date = payload.birth_date
    birth_time = payload.birth_time or "12:00"

    bazi_status = "pending"
    bazi_result_json = None
    if birth_date and birth_time:
        try:
            profile_input = ProfileCreate(
                nickname=nickname,
                gender=payload.gender or "unspecified",
                birth_date=birth_date,
                birth_time=birth_time,
                birth_timezone="Asia/Shanghai",
                birth_place=payload.birth_place,
            )
            bazi_status, bazi_result_json = calculate_bazi_json(profile_input)
        except Exception:
            pass

    user = User(email=email, password_hash=store_password(payload.password), role=invitation.role if invitation.role else UserRole.user.value)
    db.add(user)
    db.flush()

    profile = UserProfile(
        user_id=user.id,
        nickname=nickname,
        gender=payload.gender or "unspecified",
        birth_date=birth_date,
        birth_time=birth_time,
        birth_timezone="Asia/Shanghai",
        birth_place=payload.birth_place,
        current_city=payload.current_city,
        signature=payload.signature,
        bazi_status=bazi_status,
        bazi_result_json=bazi_result_json,
    )
    db.add(profile)
    create_registration_storage(db, user, name=payload.storage_name, workspace_path=payload.storage_path)

    db.commit()
    db.refresh(user)
    return user
