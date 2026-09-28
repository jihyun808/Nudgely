"""인증 경로 횟수 제한.

없으면 POST /auth/login 을 초당 수백 번 때릴 수 있다. 최소 8자에 흔한 단어를
쓰는 사람은 그대로 뚫린다.

다른 테스트에서는 꺼 둔다(conftest). 모두 같은 주소에서 가입해 서로를 막기
때문이다 — 그래서 여기서만 켜고 확인한다.
"""

import pytest
from httpx import AsyncClient

from app.core import ratelimit
from app.core.config import settings
from app.core.errors import AppError


@pytest.fixture(autouse=True)
def _limit_on(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    ratelimit.reset()
    yield
    ratelimit.reset()


async def _login(client: AsyncClient, password: str = "wrong-password"):
    return await client.post("/api/auth/login", json={"email": "a@b.com", "password": password})


async def test_login_is_capped(client: AsyncClient):
    for _ in range(10):
        assert (await _login(client)).status_code == 401

    blocked = await _login(client)

    assert blocked.status_code == 429
    assert blocked.json()["code"] == "TOO_MANY_REQUESTS"


async def test_signup_is_capped(client: AsyncClient):
    for i in range(5):
        res = await client.post(
            "/api/auth/signup",
            json={"nickname": "지수", "email": f"u{i}@b.com", "password": "password123"},
        )
        assert res.status_code == 201

    blocked = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": "u9@b.com", "password": "password123"},
    )

    assert blocked.status_code == 429


async def test_scopes_do_not_block_each_other(client: AsyncClient):
    """로그인을 여러 번 틀렸다고 가입까지 막히면, 처음 온 사람이 갇힌다."""
    for _ in range(10):
        await _login(client)

    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": "new@b.com", "password": "password123"},
    )

    assert res.status_code == 201


def test_proxy_header_identifies_the_caller():
    """운영은 프록시 뒤에 있다. 그대로 두면 모든 사용자가 한 덩어리로 세어져

    한 명이 한도를 다 써버리면 나머지가 전부 막힌다.
    """
    from starlette.datastructures import Headers
    from starlette.requests import Request

    def _request(headers: dict[str, str]) -> Request:
        scope = {
            "type": "http",
            "headers": Headers(headers).raw,
            "client": ("10.0.0.1", 0),
        }
        return Request(scope)

    assert ratelimit.client_key(_request({"x-forwarded-for": "203.0.113.7, 10.0.0.1"})) == (
        "203.0.113.7"
    )
    assert ratelimit.client_key(_request({})) == "10.0.0.1"


def test_window_resets(monkeypatch):
    """한 번 걸렸다고 영원히 막히면 안 된다."""
    now = [1000.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: now[0])

    for _ in range(3):
        ratelimit.hit("k", limit=3, window_seconds=60)
    with pytest.raises(AppError):
        ratelimit.hit("k", limit=3, window_seconds=60)

    now[0] += 61
    ratelimit.hit("k", limit=3, window_seconds=60)  # 예외가 없어야 한다
