"""운영 설정 가드.

경고 로그만 남기면 아무도 안 본다. 위험한 기본값을 달고는 아예 뜨지 않게 한다.
특히 JWT_SECRET 은 소스에 적힌 값이라, 그대로 두면 누구나 남의 토큰을 만들 수 있다.
"""

import pytest

from app.core.config import DEV_JWT_SECRET, Settings

SAFE = {
    "jwt_secret": "x" * 40,
    "auto_create_tables": False,
    "cors_origins": "https://nudgely.app",
    "public_base_url": "https://api.nudgely.app",
    "database_url": "postgresql://u:p@db.example.com/nudgely",
}


def _settings(**overrides) -> Settings:
    return Settings(app_env="prod", **{**SAFE, **overrides})


def test_dev_is_not_blocked():
    """개발은 기본값 그대로 써야 한다."""
    Settings(app_env="dev", jwt_secret=DEV_JWT_SECRET).assert_production_ready()


def test_safe_production_passes():
    _settings().assert_production_ready()


def test_default_jwt_secret_blocks_startup():
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        _settings(jwt_secret=DEV_JWT_SECRET).assert_production_ready()


def test_short_jwt_secret_blocks_startup():
    """HMAC-SHA256 은 32바이트 미만이면 권장 강도에 못 미친다(RFC 7518 §3.2)."""
    with pytest.raises(RuntimeError, match="너무 짧습니다"):
        _settings(jwt_secret="short-secret").assert_production_ready()


def test_wildcard_cors_blocks_startup():
    """allow_credentials=True 와 '*' 가 만나면 인증 정보까지 열린다."""
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        _settings(cors_origins="*").assert_production_ready()


def test_auto_create_tables_blocks_startup():
    with pytest.raises(RuntimeError, match="AUTO_CREATE_TABLES"):
        _settings(auto_create_tables=True).assert_production_ready()


def test_all_problems_are_reported_at_once():
    """하나 고치고 다시 떠서 또 막히는 걸 반복하지 않게 한 번에 다 알려준다."""
    with pytest.raises(RuntimeError) as exc:
        _settings(
            jwt_secret=DEV_JWT_SECRET, auto_create_tables=True, cors_origins="*"
        ).assert_production_ready()
    message = str(exc.value)
    assert "JWT_SECRET" in message
    assert "CORS_ORIGINS" in message
    assert "AUTO_CREATE_TABLES" in message


def test_sqlite_blocks_startup():
    """컨테이너가 재시작하면 파일이 통째로 사라진다. 배포 첫날 겪으면 늦다."""
    with pytest.raises(RuntimeError, match="SQLite"):
        _settings(database_url="sqlite+aiosqlite:///./nudgely.db").assert_production_ready()


@pytest.mark.parametrize("url", ["", "http://localhost:8000"])
def test_local_public_base_url_blocks_startup(url: str):
    """첨부 URL 에 그대로 박혀 나간다. 앱에서는 사진이 하나도 안 열린다."""
    with pytest.raises(RuntimeError, match="PUBLIC_BASE_URL"):
        _settings(public_base_url=url).assert_production_ready()
