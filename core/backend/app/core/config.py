from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    app_name: str = "DayOrder"
    debug: bool = True
    database_url: str | None = None
    workspace_dir: Path | None = None
    session_expire_days: int = 30

    # 云端同步配置
    cloud_api_url: str | None = None  # 云端 API 地址，如 https://api.dayorder.com
    cloud_sync_enabled: bool = False  # 是否启用云端同步

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def workspace_path(self) -> Path:
        """本地备份目录。默认: C:/DayOrderBackup"""
        if self.workspace_dir:
            return self.workspace_dir.expanduser().resolve()
        return Path("C:/DayOrderBackup")

    @property
    def sqlite_path(self) -> Path:
        return self.workspace_path / "dayorder.db"

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite:///{self.sqlite_path.as_posix()}"

    @property
    def data_dir(self) -> Path:
        if self.resolved_database_url.startswith("sqlite:///"):
            db_path = Path(self.resolved_database_url.removeprefix("sqlite:///"))
            return db_path.parent
        return self.workspace_path

    @property
    def uploads_dir(self) -> Path:
        return self.workspace_path / "uploads"

    @property
    def exports_dir(self) -> Path:
        return self.workspace_path / "exports"


@lru_cache
def get_settings() -> Settings:
    return Settings()
