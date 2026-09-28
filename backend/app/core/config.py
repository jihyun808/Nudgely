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

#: libpq 만 아는 접속 옵션. asyncpg 에 넘기면 "모르는 인자" 로 거절당한다
_LIBPQ_ONLY_PARAMS = frozenset({"sslmode", "channel_binding", "options", "target_session_attrs"})


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
    # 개발: SQLite(async). 운영: Postgres.
    # 호스팅이 주는 주소를 그대로 넣어도 된다 — async_database_url 이 고쳐 쓴다.
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

    # ── 요청 횟수 제한 ──
    # 인증 경로(로그인·가입·비밀번호)에 건다. 테스트에서는 꺼 둔다 —
    # 모든 테스트가 같은 주소에서 가입해서, 켜 두면 서로를 막는다.
    rate_limit_enabled: bool = True

    # ── 스케줄러(밤 11시 점검) ──
    scheduler_enabled: bool = True
    # 점검 실행 시각(시). **사용자 로컬 시각 기준** — 스케줄러가 매시간 깨어나
    # 지금 로컬로 이 시각인 사용자만 처리한다. 타임존은 UserSettings.timezone.
    nightly_hour: int = 23

    # ── 푸시(FCM HTTP v1) ──
    # 앱이 꺼져 있을 때 알릴 유일한 수단이다. 자격 증명이 없으면 조용히 건너뛴다
    # (개발·테스트에서 푸시 때문에 아무것도 막히지 않아야 한다).
    push_enabled: bool = True
    #: 서비스 계정 키 JSON **경로**. '프로젝트 설정 > 서비스 계정' 에서 발급한다.
    #: 로컬 개발용. **저장소에 커밋하지 말 것** — 이 파일 하나로 누구에게든 보낼 수 있다.
    fcm_credentials_file: str = ""
    #: 같은 키의 JSON **내용**. 배포에서 쓴다 — 호스팅에 파일을 올릴 방법이 마땅치
    #: 않아서, 통째로 환경변수에 넣는 쪽이 일반적이다. 둘 다 있으면 이쪽이 이긴다.
    fcm_credentials_json: str = ""
    #: Firebase 프로젝트 ID. 비워 두면 서비스 계정 키의 project_id 를 쓴다
    #: (키 파일에 이미 들어 있어서, 굳이 두 군데에 적고 어긋나게 둘 이유가 없다).
    fcm_project_id: str = ""

    @property
    def push_configured(self) -> bool:
        """자격 증명이 있는지. 없으면 발송을 조용히 건너뛴다."""
        return bool(self.push_enabled and (self.fcm_credentials_json or self.fcm_credentials_file))

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
        if not self.public_base_url or any(
            local in self.public_base_url for local in ("localhost", "127.0.0.1")
        ):
            problems.append(
                "PUBLIC_BASE_URL 이 비었거나 로컬 주소입니다. 첨부·프로필 사진 URL 에 "
                "그대로 박혀 나가서, 앱에서는 아무것도 열리지 않습니다."
            )
        if self.database_url.startswith("sqlite"):
            problems.append(
                "DATABASE_URL 이 SQLite 입니다. 컨테이너가 재시작하면 데이터가 통째로 "
                "사라집니다(Postgres 를 쓰세요)."
            )

        if problems:
            raise RuntimeError("운영 설정이 안전하지 않습니다:\n- " + "\n- ".join(problems))

    @property
    def async_database_url(self) -> str:
        """비동기 드라이버로 붙을 수 있게 고친 DB 주소.

        호스팅(Railway·Neon 등)은 `postgresql://...` 를 준다. 이대로 쓰면
        SQLAlchemy 가 동기 드라이버(psycopg2)를 찾다가 죽는데, 에러 메시지가
        "드라이버가 없다" 라서 원인을 찾는 데 한참 걸린다. 여기서 고쳐 쓴다.

        `sslmode` 같은 libpq 전용 옵션도 떼어낸다 — asyncpg 는 모르는 인자라며
        거절한다(Neon 주소에 기본으로 붙어 있다). asyncpg 는 어차피 서버가
        요구하면 TLS 로 붙는다.
        """
        url = self.database_url
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                url = "postgresql+asyncpg://" + url[len(prefix) :]
                break
        if "+asyncpg" not in url or "?" not in url:
            return url

        base, _, query = url.partition("?")
        kept = [
            part
            for part in query.split("&")
            if part and part.split("=")[0] not in _LIBPQ_ONLY_PARAMS
        ]
        return f"{base}?{'&'.join(kept)}" if kept else base

    @property
    def cors_origins_list(self) -> list[str]:
        """쉼표로 구분된 CORS_ORIGINS 문자열을 리스트로 변환."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """설정 싱글턴. lru_cache 로 앱 전체에서 한 번만 로드."""
    return Settings()


settings = get_settings()
