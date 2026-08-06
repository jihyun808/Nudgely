"""애플리케이션 설정.

.env 파일 또는 실제 환경변수에서 값을 읽어옵니다.
어디서든 `from app.core.config import settings` 로 접근하세요.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── OpenAI ──
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_timeout: int = 60

    # ── App ──
    app_env: str = "dev"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ── DB ──
    # 개발: SQLite(async). 운영: postgresql+asyncpg://user:pw@host/db 로 교체.
    database_url: str = "sqlite+aiosqlite:///./nudgely.db"
    db_echo: bool = False  # True 면 실행되는 SQL 을 로그로 출력
    # 앱 시작 시 테이블 자동 생성(개발 편의). 운영은 False + Alembic 마이그레이션.
    auto_create_tables: bool = True

    # ── 인증(JWT) ──
    # ⚠️ 운영에서는 반드시 .env 로 강력한 비밀키를 주입할 것.
    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    # 액세스 토큰 만료(분). 현재는 리프레시 토큰 없이 만료 시 재로그인(api.md §8-2).
    access_token_expire_minutes: int = 60 * 24 * 7  # 7일

    # ── 스케줄러(밤 11시 점검) ──
    scheduler_enabled: bool = True
    # 점검 실행 시각(시, UTC 기준). ⚠️ 사용자 로컬 타임존 반영은 후속.
    nightly_hour: int = 23

    # ── 파일 스토리지 ──
    # 로컬 개발: 디스크에 저장하고 /static 으로 서빙. 운영은 S3 등으로 교체.
    storage_dir: str = "./media"
    # 첨부 URL 앞에 붙는 절대 주소(프론트가 바로 열 수 있어야 함).
    public_base_url: str = "http://localhost:8000"
    max_chat_file_mb: int = 10  # 채팅 첨부(jpg·jpeg·png·pdf·txt)
    max_image_mb: int = 5  # 목표·프로필 이미지(jpg·png)

    @property
    def cors_origins_list(self) -> list[str]:
        """쉼표로 구분된 CORS_ORIGINS 문자열을 리스트로 변환."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """설정 싱글턴. lru_cache 로 앱 전체에서 한 번만 로드."""
    return Settings()


settings = get_settings()
