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
