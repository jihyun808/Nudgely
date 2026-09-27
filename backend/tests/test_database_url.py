"""DB 주소 정규화.

호스팅(Railway·Neon 등)이 주는 주소를 그대로 붙여넣어도 뜨게 한다.
여기서 안 고치면 "psycopg2 가 없다"는 엉뚱한 에러를 만나 한참 헤맨다.
"""

import pytest

from app.core.config import Settings


def _url(raw: str) -> str:
    return Settings(database_url=raw).async_database_url


@pytest.mark.parametrize("prefix", ["postgresql://", "postgres://"])
def test_sync_scheme_becomes_asyncpg(prefix: str):
    """postgres:// 는 예전 형식이지만 아직 이걸 주는 호스팅이 있다."""
    assert _url(f"{prefix}u:p@host/db") == "postgresql+asyncpg://u:p@host/db"


def test_already_async_is_left_alone():
    url = "postgresql+asyncpg://u:p@host/db"
    assert _url(url) == url


def test_sqlite_is_left_alone():
    """개발은 그대로 SQLite 로 돈다."""
    url = "sqlite+aiosqlite:///./nudgely.db"
    assert _url(url) == url


def test_libpq_only_options_are_dropped():
    """asyncpg 는 sslmode 를 모르는 인자라며 거절한다(Neon 주소에 기본으로 붙는다)."""
    assert (
        _url("postgresql://u:p@host/db?sslmode=require&channel_binding=require")
        == "postgresql+asyncpg://u:p@host/db"
    )


def test_other_options_survive():
    """전부 떼어내면 안 된다. 모르는 옵션까지 버리면 조용히 설정이 사라진다."""
    assert (
        _url("postgresql://u:p@host/db?sslmode=require&application_name=nudgely")
        == "postgresql+asyncpg://u:p@host/db?application_name=nudgely"
    )
