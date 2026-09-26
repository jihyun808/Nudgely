"""FCM 푸시 (api.md §5.3).

앱이 꺼져 있을 때 닿는 유일한 길이다. 세 가지를 지켜야 한다:
- 자격 증명이 없으면 조용히 건너뛴다(개발·CI 에서 아무것도 막히지 않는다).
- 죽은 토큰은 보내다가 알게 되는 즉시 지운다.
- 푸시가 실패해도 호출한 쪽은 멀쩡하다.
"""

import json

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import settings
from app.models.device import DeviceToken
from app.models.goal import Goal
from app.services import notification_service, push_service
from app.services.notification_service import notify_reply
from app.services.push_service import send_to_user
from tests.helpers import auth, create_goal, token_for, user_id_of

TOKEN = "fcm-token-abcdefghijklmn"


def _configure(monkeypatch, handler) -> None:
    """푸시가 켜진 것처럼 만들고 FCM 응답을 가짜로 준다."""
    monkeypatch.setattr(settings, "fcm_project_id", "nudgely-test")
    monkeypatch.setattr(settings, "fcm_credentials_file", "/tmp/fake-key.json")
    monkeypatch.setattr(push_service, "_get_access_token", _fake_access_token)
    monkeypatch.setattr(
        push_service,
        "_new_client",
        lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


async def _fake_access_token(_client) -> str:
    return "access-token"


async def _register(client, token_value: str = TOKEN, *, email: str = "p@b.com") -> str:
    token = await token_for(client, email)
    res = await client.post(
        "/api/devices",
        headers=auth(token),
        json={"token": token_value, "platform": "android"},
    )
    assert res.status_code == 204
    return token


# ── 기기 등록 ──


async def test_register_device(client, session_factory: async_sessionmaker):
    token = await _register(client)

    async with session_factory() as db:
        device = await db.get(DeviceToken, TOKEN)
    assert device is not None
    assert device.user_id == await user_id_of(client, token)
    assert device.platform == "android"


async def test_registering_twice_keeps_one_row(client, session_factory: async_sessionmaker):
    """앱은 켜질 때마다 등록한다. 매번 행이 늘면 같은 기기에 여러 번 울린다."""
    token = await _register(client)
    await client.post(
        "/api/devices", headers=auth(token), json={"token": TOKEN, "platform": "android"}
    )

    async with session_factory() as db:
        rows = (await db.execute(select(DeviceToken))).scalars().all()
    assert len(rows) == 1


async def test_another_account_takes_over_the_device(client, session_factory: async_sessionmaker):
    """기기를 빌려 로그인하면 이전 사용자의 알림이 따라가면 안 된다."""
    await _register(client, email="first@b.com")
    second = await token_for(client, "second@b.com")

    await client.post(
        "/api/devices", headers=auth(second), json={"token": TOKEN, "platform": "ios"}
    )

    async with session_factory() as db:
        device = await db.get(DeviceToken, TOKEN)
    assert device.user_id == await user_id_of(client, second)


async def test_unregister(client, session_factory: async_sessionmaker):
    token = await _register(client)

    res = await client.delete(f"/api/devices/{TOKEN}", headers=auth(token))

    assert res.status_code == 204
    async with session_factory() as db:
        assert await db.get(DeviceToken, TOKEN) is None


async def test_cannot_unregister_someone_elses_device(client, session_factory: async_sessionmaker):
    """토큰만 알면 남의 알림을 끌 수 있으면 안 된다."""
    await _register(client, email="owner@b.com")
    other = await token_for(client, "other@b.com")

    await client.delete(f"/api/devices/{TOKEN}", headers=auth(other))

    async with session_factory() as db:
        assert await db.get(DeviceToken, TOKEN) is not None


async def test_register_requires_login(client):
    res = await client.post("/api/devices", json={"token": TOKEN, "platform": "android"})
    assert res.status_code == 401


@pytest.mark.parametrize("platform", ["windows", ""])
async def test_unknown_platform_is_rejected(client, platform: str):
    token = await token_for(client, "plat@b.com")
    res = await client.post(
        "/api/devices", headers=auth(token), json={"token": TOKEN, "platform": platform}
    )
    assert res.status_code == 422


# ── 발송 ──


async def test_no_credentials_means_no_push(client, session_factory: async_sessionmaker):
    """개발·CI 에서 푸시 설정 없이 전부 돌아가야 한다."""
    await _register(client)

    async with session_factory() as db:
        assert await send_to_user(db, "u_any", title="t", body="b") == 0


async def test_sends_to_every_device(client, session_factory: async_sessionmaker, monkeypatch):
    token = await _register(client)
    await client.post(
        "/api/devices",
        headers=auth(token),
        json={"token": "second-device-token", "platform": "ios"},
    )
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"name": "ok"})

    _configure(monkeypatch, handler)
    user_id = await user_id_of(client, token)

    async with session_factory() as db:
        sent = await send_to_user(db, user_id, title="선대냥이", body="1-1 수업 시작했어?")

    assert sent == 2
    assert {m["message"]["token"] for m in seen} == {TOKEN, "second-device-token"}
    assert seen[0]["message"]["notification"]["body"] == "1-1 수업 시작했어?"


async def test_dead_token_is_deleted(client, session_factory: async_sessionmaker, monkeypatch):
    """앱을 지운 기기에 영원히 보내지 않는다."""
    token = await _register(client)

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": {"status": "UNREGISTERED"}})

    _configure(monkeypatch, handler)
    user_id = await user_id_of(client, token)

    async with session_factory() as db:
        sent = await send_to_user(db, user_id, title="t", body="b")
        await db.commit()

    assert sent == 0
    async with session_factory() as db:
        assert await db.get(DeviceToken, TOKEN) is None


async def test_server_error_keeps_the_token(
    client, session_factory: async_sessionmaker, monkeypatch
):
    """FCM 이 잠깐 죽은 것과 토큰이 죽은 것은 다르다. 지우면 복구할 길이 없다."""
    token = await _register(client)

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="backend unavailable")

    _configure(monkeypatch, handler)
    user_id = await user_id_of(client, token)

    async with session_factory() as db:
        await send_to_user(db, user_id, title="t", body="b")
        await db.commit()

    async with session_factory() as db:
        assert await db.get(DeviceToken, TOKEN) is not None


async def test_one_broken_device_does_not_stop_the_rest(
    client, session_factory: async_sessionmaker, monkeypatch
):
    token = await _register(client)
    await client.post(
        "/api/devices", headers=auth(token), json={"token": "good-device-token", "platform": "ios"}
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if json.loads(request.content)["message"]["token"] == TOKEN:
            raise httpx.ConnectError("연결 실패")
        return httpx.Response(200, json={"name": "ok"})

    _configure(monkeypatch, handler)
    user_id = await user_id_of(client, token)

    async with session_factory() as db:
        assert await send_to_user(db, user_id, title="t", body="b") == 1


async def test_body_is_truncated(client, session_factory: async_sessionmaker, monkeypatch):
    """긴 본문은 어차피 알림에서 잘린다. 보내기 전에 자른다."""
    token = await _register(client)
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"name": "ok"})

    _configure(monkeypatch, handler)
    user_id = await user_id_of(client, token)

    async with session_factory() as db:
        await send_to_user(db, user_id, title="t", body="가" * 500)

    assert len(seen[0]["message"]["notification"]["body"]) == push_service.MAX_BODY


# ── 대화 답변 푸시 (종 아이콘에는 안 쌓는다) ──


async def test_reply_push_when_nobody_is_watching(
    client, session_factory: async_sessionmaker, monkeypatch
):
    """앱을 껐거나 방을 나갔으면 답이 온 걸 알 길이 없다."""
    pushed: list[tuple[str, str]] = []
    monkeypatch.setattr(
        notification_service,
        "push_in_background",
        lambda uid, *, title, body, data=None: pushed.append((title, body)),
    )

    token = await token_for(client, "reply@b.com")
    goal_id = await create_goal(client, token, name="선대냥이")
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        await notify_reply(db, goal, "1강부터 하자")

    assert pushed == [("선대냥이", "1강부터 하자")]


async def test_reply_push_does_not_pile_up_in_the_bell(
    client, session_factory: async_sessionmaker, monkeypatch
):
    """내가 방금 걸어서 온 답이다. 목록에 남기면 읽은 말이 안 읽은 알림으로 또 뜬다."""
    monkeypatch.setattr(
        notification_service, "push_in_background", lambda uid, *, title, body, data=None: None
    )

    token = await token_for(client, "bell@b.com")
    goal_id = await create_goal(client, token)
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        await notify_reply(db, goal, "1강부터 하자")
        await db.commit()

    assert (await client.get("/api/notifications", headers=auth(token))).json() == []


async def test_muted_goal_gets_no_reply_push(
    client, session_factory: async_sessionmaker, monkeypatch
):
    pushed: list[str] = []
    monkeypatch.setattr(
        notification_service,
        "push_in_background",
        lambda uid, *, title, body, data=None: pushed.append(body),
    )

    token = await token_for(client, "muted@b.com")
    goal_id = await create_goal(client, token)
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        goal.is_notification_muted = True
        await notify_reply(db, goal, "1강부터 하자")

    assert pushed == []


async def test_master_switch_off_stops_reply_push(
    client, session_factory: async_sessionmaker, monkeypatch
):
    pushed: list[str] = []
    monkeypatch.setattr(
        notification_service,
        "push_in_background",
        lambda uid, *, title, body, data=None: pushed.append(body),
    )

    token = await token_for(client, "off@b.com")
    goal_id = await create_goal(client, token)
    await client.patch(
        "/api/settings", headers=auth(token), json={"notifications": {"enabled": False}}
    )
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        await notify_reply(db, goal, "1강부터 하자")

    assert pushed == []


async def test_bell_notifications_also_push(
    client, session_factory: async_sessionmaker, monkeypatch
):
    """종 아이콘에 쌓는 알림은 푸시로도 나간다 — 앱을 열어야 보이면 늦는다."""
    pushed: list[tuple[str, str]] = []
    monkeypatch.setattr(
        notification_service,
        "push_in_background",
        lambda uid, *, title, body, data=None: pushed.append((title, body)),
    )

    token = await token_for(client, "both@b.com")
    user_id = await user_id_of(client, token)
    async with session_factory() as db:
        await notification_service.create_notification(
            db, user_id, ntype="todoAdded", title="오늘의 할 일", body="3개 추가했어"
        )
        await db.commit()

    assert pushed == [("오늘의 할 일", "3개 추가했어")]
    assert len((await client.get("/api/notifications", headers=auth(token))).json()) == 1
