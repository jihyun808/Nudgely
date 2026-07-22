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

    @property
    def cors_origins_list(self) -> list[str]:
        """쉼표로 구분된 CORS_ORIGINS 문자열을 리스트로 변환."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """설정 싱글턴. lru_cache 로 앱 전체에서 한 번만 로드."""
    return Settings()


settings = get_settings()
