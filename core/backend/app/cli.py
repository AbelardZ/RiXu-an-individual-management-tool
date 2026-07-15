import argparse
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, init_db
from app.core.security import hash_secret, store_password, utcnow
from app.models.auth import InvitationCode, User, UserRole, UserStatus
from app.services.auth import get_user_by_email, normalize_email


def create_admin(args: argparse.Namespace) -> None:
    init_db()
    db: Session = SessionLocal()
    try:
        email = normalize_email(args.email)
        if get_user_by_email(db, email):
            raise SystemExit(f"Admin already exists: {email}")
        user = User(
            email=email,
            password_hash=store_password(args.password),
            role=UserRole.admin.value,
            status=UserStatus.active.value,
        )
        db.add(user)
        db.commit()
        print(f"Created admin: {email}")
    finally:
        db.close()


def reset_password(args: argparse.Namespace) -> None:
    init_db()
    db: Session = SessionLocal()
    try:
        email = normalize_email(args.email)
        user = get_user_by_email(db, email)
        if not user:
            raise SystemExit(f"User not found: {email}")
        user.password_hash = store_password(args.password)
        db.commit()
        print(f"Password reset: {email}")
    finally:
        db.close()


def create_invite(args: argparse.Namespace) -> None:
    """创建邀请码"""
    init_db()
    db: Session = SessionLocal()
    try:
        raw_code = args.code or secrets.token_urlsafe(16)
        code_hash = hash_secret(raw_code)

        expires_at = None
        if args.expires_days:
            expires_at = utcnow() + timedelta(days=args.expires_days)

        invite = InvitationCode(
            code_hash=code_hash,
            assigned_email=normalize_email(args.email) if args.email else None,
            role=args.role or UserRole.user.value,
            max_uses=args.max_uses,
            expires_at=expires_at,
        )
        db.add(invite)
        db.commit()
        db.refresh(invite)

        print(f"邀请码已创建:")
        print(f"  邀请码: {raw_code}")
        print(f"  ID: {invite.id}")
        if args.email:
            print(f"  绑定邮箱: {args.email}")
        print(f"  角色: {invite.role}")
        print(f"  最大使用次数: {invite.max_uses}")
        if expires_at:
            print(f"  过期时间: {expires_at}")
        print(f"\n⚠️  请妥善保管此邀请码，原始码仅显示一次！")
    finally:
        db.close()


def list_invites(args: argparse.Namespace) -> None:
    """列出所有邀请码"""
    init_db()
    db: Session = SessionLocal()
    try:
        codes = db.query(InvitationCode).order_by(InvitationCode.created_at.desc()).all()
        if not codes:
            print("暂无邀请码")
            return
        print(f"{'ID':<6} {'绑定邮箱':<30} {'角色':<8} {'已用/上限':<12} {'状态':<10} {'创建时间'}")
        print("-" * 100)
        for c in codes:
            status = "已禁用" if c.disabled_at else ("已过期" if c.expires_at and c.expires_at < utcnow() else "有效")
            print(f"{c.id:<6} {c.assigned_email or '(不限)':<30} {c.role:<8} {c.used_count}/{c.max_uses if c.max_uses > 0 else '∞':<12} {status:<10} {c.created_at}")
    finally:
        db.close()


def disable_invite(args: argparse.Namespace) -> None:
    """禁用邀请码"""
    init_db()
    db: Session = SessionLocal()
    try:
        invite = db.query(InvitationCode).filter(InvitationCode.id == args.id).first()
        if not invite:
            raise SystemExit(f"邀请码不存在: {args.id}")
        invite.disabled_at = utcnow()
        db.commit()
        print(f"已禁用邀请码: {args.id}")
    finally:
        db.close()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="DayOrder backend CLI")
    subparsers = parser.add_subparsers(required=True)

    admin = subparsers.add_parser("create-admin", help="创建管理员账号")
    admin.add_argument("--email", required=True)
    admin.add_argument("--password", required=True)
    admin.set_defaults(func=create_admin)

    reset = subparsers.add_parser("reset-password", help="重置账号密码")
    reset.add_argument("--email", required=True)
    reset.add_argument("--password", required=True)
    reset.set_defaults(func=reset_password)

    invite = subparsers.add_parser("create-invite", help="创建邀请码")
    invite.add_argument("--code", default=None, help="自定义邀请码（不指定则自动生成）")
    invite.add_argument("--email", default=None, help="绑定邮箱（不指定则不限）")
    invite.add_argument("--role", default=None, choices=["admin", "user"], help="注册角色（默认 user）")
    invite.add_argument("--max-uses", type=int, default=1, help="最大使用次数（默认 1，0 表示不限）")
    invite.add_argument("--expires-days", type=int, default=None, help="有效天数（不指定则永不过期）")
    invite.set_defaults(func=create_invite)

    list_cmd = subparsers.add_parser("list-invites", help="列出所有邀请码")
    list_cmd.set_defaults(func=list_invites)

    disable = subparsers.add_parser("disable-invite", help="禁用邀请码")
    disable.add_argument("--id", type=int, required=True, help="邀请码 ID")
    disable.set_defaults(func=disable_invite)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
