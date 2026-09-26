"""애플리케이션 설정.

.env 파일 또는 실제 환경변수에서 값을 읽어옵니다.
어디서든 `from app.core.config import settings` 로 접근하세요.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

#: 개발용 기본 JWT 비밀키. 소스에 있는 값이라 이걸로 서명하면 누구나 토큰을 위조할 수 있다.
DEV_JWT_SECRET = "dev-insecure-change-me"

#: HMAC-SHA256 권장 최소 길이(RFC 7518 §3.2)
MIN_JWT_SECRET_BYTES = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── OpenAI ──
    openai_api_key: str = ""
    # 모델 티어. 나누는 기준은 '대화 vs 구조화 출력' 이 아니라
    # **사용자가 기다리는가** 다. 채팅 한 턴은 도구를 고르는 판단까지 품질이
    # 그대로 드러나서(엉뚱한 도구를 부르면 사용자가 바로 본다) 좋은 모델을 쓰고,
    # 아무도 안 보는 배치(밤 11시 독촉 문구 등)는 싼 모델로 충분하다.
    openai_chat_model: str = "gpt-4.1"
    openai_batch_model: str = "gpt-4o-mini"
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
    #: 아래 값 그대로면 운영에서 起動을 막는다(assert_production_ready)
    jwt_secret: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    # 액세스 토큰 만료(분). 현재는 리프레시 토큰 없이 만료 시 재로그인(api.md §8-2).
    access_token_expire_minutes: int = 60 * 24 * 7  # 7일

    # ── 스케줄러(밤 11시 점검) ──
    scheduler_enabled: bool = True
    # 점검 실행 시각(시). **사용자 로컬 시각 기준** — 스케줄러가 매시간 깨어나
    # 지금 로컬로 이 시각인 사용자만 처리한다. 타임존은 UserSettings.timezone.
    nightly_hour: int = 23

    # ── 푸시(FCM HTTP v1) ──
    # 앱이 꺼져 있을 때 알릴 유일한 수단이다. 자격 증명이 없으면 조용히 건너뛴다
    # (개발·테스트에서 푸시 때문에 아무것도 막히지 않아야 한다).
    push_enabled: bool = True
    #: Firebase 프로젝트 ID. 콘솔의 '프로젝트 설정 > 일반' 에 있다.
    fcm_project_id: str = ""
    #: 서비스 계정 키 JSON 경로. '프로젝트 설정 > 서비스 계정' 에서 발급한다.
    #: **저장소에 커밋하지 말 것** — 이 파일 하나로 누구에게든 푸시를 보낼 수 있다.
    fcm_credentials_file: str = ""

    @property
    def push_configured(self) -> bool:
        return bool(self.push_enabled and self.fcm_project_id and self.fcm_credentials_file)

    # ── 파일 스토리지 ──
    # 로컬 개발: 디스크에 저장하고 /static 으로 서빙. 운영은 S3 등으로 교체.
    storage_dir: str = "./media"
    # 첨부 URL 앞에 붙는 절대 주소(프론트가 바로 열 수 있어야 함).
    public_base_url: str = "http://localhost:8000"
    max_chat_file_mb: int = 10  # 채팅 첨부(jpg·jpeg·png·pdf·txt)
    max_image_mb: int = 5  # 목표·프로필 이미지(jpg·png)

    def assert_production_ready(self) -> None:
        """운영에서 위험한 기본값이 남아 있으면 起動을 막는다.

        경고만 남기면 아무도 안 본다. 특히 JWT 비밀키는 소스에 적힌 값이라
        그대로 두면 누구나 남의 토큰을 만들 수 있어, 켜지지 않는 편이 낫다.
        """
        if self.app_env == "dev":
            return

        problems: list[str] = []
        if self.jwt_secret == DEV_JWT_SECRET:
            problems.append(
                "JWT_SECRET 이 개발용 기본값입니다. 소스에 적힌 값이라 토큰을 위조할 수 있습니다."
            )
        elif len(self.jwt_secret.encode()) < MIN_JWT_SECRET_BYTES:
            problems.append(
                f"JWT_SECRET 이 너무 짧습니다({len(self.jwt_secret.encode())}바이트). "
                f"{MIN_JWT_SECRET_BYTES}바이트 이상을 쓰세요."
            )
        if "*" in self.cors_origins_list:
            problems.append(
                "CORS_ORIGINS 에 '*' 는 쓸 수 없습니다(쿠키·인증 헤더가 함께 열립니다)."
            )
        if self.auto_create_tables:
            problems.append(
                "AUTO_CREATE_TABLES 는 운영에서 false 여야 합니다(마이그레이션으로 관리)."
            )

        if problems:
            raise RuntimeError("운영 설정이 안전하지 않습니다:\n- " + "\n- ".join(problems))

    @property
    def cors_origins_list(self) -> list[str]:
        """쉼표로 구분된 CORS_ORIGINS 문자열을 리스트로 변환."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """설정 싱글턴. lru_cache 로 앱 전체에서 한 번만 로드."""
    return Settings()


settings = get_settings()
