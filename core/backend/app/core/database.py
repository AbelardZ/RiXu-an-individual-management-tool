from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings
from app.core.workspace import database_health, initialize_workspace, initialize_workspace_path


class Base(DeclarativeBase):
    pass


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.resolved_database_url.startswith("sqlite") else {}
engine = create_engine(settings.resolved_database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
_content_engines: dict[str, Engine] = {}


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    initialize_workspace(settings)
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_local_schema(engine)
    health = database_health(engine, settings)
    if not health["connectable"] or not health["core_tables_present"]:
        raise RuntimeError(f"database health check failed: {health}")


def init_content_database(workspace_path: Path) -> None:
    initialize_workspace_path(workspace_path, settings.app_name)
    target_engine = get_content_engine(workspace_path)
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=target_engine)
    _ensure_local_schema(target_engine)


def get_content_engine(workspace_path: Path) -> Engine:
    """获取内容数据库引擎。
    
    云端部署时，内容数据库与主数据库共用 PostgreSQL；
    本地部署时，使用工作区目录下的 SQLite。
    """
    # 如果主数据库是 PostgreSQL，内容数据库也使用同一个 PostgreSQL
    if not settings.resolved_database_url.startswith("sqlite"):
        cache_key = "postgresql_main"
        if cache_key not in _content_engines:
            _content_engines[cache_key] = create_engine(settings.resolved_database_url)
        return _content_engines[cache_key]
    
    # 本地 SQLite 模式
    db_path = workspace_path / "dayorder.db"
    cache_key = str(db_path.resolve())
    if cache_key not in _content_engines:
        _content_engines[cache_key] = create_engine(f"sqlite:///{db_path.as_posix()}", connect_args={"check_same_thread": False})
    return _content_engines[cache_key]


def content_session_for_workspace(workspace_path: Path) -> Session:
    init_content_database(workspace_path)
    return sessionmaker(bind=get_content_engine(workspace_path), autoflush=False, autocommit=False)()


def _ensure_local_schema(target_engine: Engine) -> None:
    """确保本地 SQLite 数据库的 schema 与模型同步（仅 SQLite 需要手动迁移）。"""
    if not settings.resolved_database_url.startswith("sqlite"):
        return
    inspector = inspect(target_engine)
    if "daily_task_templates" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("daily_task_templates")}
    if "time_period" not in columns:
        with target_engine.begin() as connection:
            connection.execute(text("ALTER TABLE daily_task_templates ADD COLUMN time_period VARCHAR(16) NOT NULL DEFAULT 'all_day'"))
    auth_columns = {column["name"] for column in inspector.get_columns("auth_sessions")}
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    profile_columns = {column["name"] for column in inspector.get_columns("user_profiles")}
    with target_engine.begin() as connection:
        if "token_lookup_hash" not in auth_columns:
            connection.execute(text("ALTER TABLE auth_sessions ADD COLUMN token_lookup_hash VARCHAR(64)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_auth_sessions_token_lookup_hash ON auth_sessions (token_lookup_hash)"))
        if "active_storage_id" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN active_storage_id INTEGER"))
        if "avatar_url" not in profile_columns:
            connection.execute(text("ALTER TABLE user_profiles ADD COLUMN avatar_url VARCHAR(512)"))
        if "signature" not in profile_columns:
            connection.execute(text("ALTER TABLE user_profiles ADD COLUMN signature VARCHAR(200)"))
        if "weather_cities_json" not in profile_columns:
            connection.execute(text("ALTER TABLE user_profiles ADD COLUMN weather_cities_json TEXT"))
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS user_storages ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "user_id INTEGER NOT NULL, "
                "name VARCHAR(120) NOT NULL, "
                "workspace_path VARCHAR(1024) NOT NULL, "
                "is_initialized INTEGER NOT NULL DEFAULT 1, "
                "created_at DATETIME NOT NULL, "
                "updated_at DATETIME NOT NULL, "
                "deleted_at DATETIME, "
                "FOREIGN KEY(user_id) REFERENCES users (id)"
                ")"
            )
        )
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_user_storages_user_id ON user_storages (user_id)"))
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS attachments ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "owner_type VARCHAR(64) NOT NULL, "
                "owner_id INTEGER NOT NULL, "
                "file_name VARCHAR(255) NOT NULL, "
                "file_path VARCHAR(512) NOT NULL, "
                "mime_type VARCHAR(128), "
                "size INTEGER NOT NULL DEFAULT 0, "
                "created_at DATETIME NOT NULL, "
                "updated_at DATETIME NOT NULL"
                ")"
            )
        )
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_attachments_owner_type ON attachments (owner_type)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_attachments_owner_id ON attachments (owner_id)"))
    range_columns = {column["name"] for column in inspector.get_columns("range_reminders")}
    with target_engine.begin() as connection:
        if "category_id" not in range_columns:
            connection.execute(text("ALTER TABLE range_reminders ADD COLUMN category_id INTEGER"))
        if "steps_json" not in range_columns:
            connection.execute(text("ALTER TABLE range_reminders ADD COLUMN steps_json TEXT NOT NULL DEFAULT '[]'"))
        if "completed_at" not in range_columns:
            connection.execute(text("ALTER TABLE range_reminders ADD COLUMN completed_at DATETIME"))
    milestone_columns = {column["name"] for column in inspector.get_columns("milestone_days")}
    with target_engine.begin() as connection:
        if "color" not in milestone_columns:
            connection.execute(text("ALTER TABLE milestone_days ADD COLUMN color VARCHAR(24)"))
        if "calendar_type" not in milestone_columns:
            connection.execute(text("ALTER TABLE milestone_days ADD COLUMN calendar_type VARCHAR(16) NOT NULL DEFAULT 'solar'"))
        connection.execute(
            text(
                "UPDATE milestone_days "
                "SET background_url = replace(background_url, '/data/milestone-backgrounds/', '/uploads/milestones/') "
                "WHERE background_url LIKE '/data/milestone-backgrounds/%'"
            )
        )
        connection.execute(
            text(
                "UPDATE user_profiles "
                "SET avatar_url = replace(avatar_url, '/data/avatars/', '/uploads/avatars/') "
                "WHERE avatar_url LIKE '/data/avatars/%'"
            )
        )
