"""홈 미리보기 · 알림 테스트."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.tools import dispatch_tool_call
from app.models.goal import Goal, Message
from app.models.notification import Notification
from app.models.user import UserSettings
from app.services.notification_service import RECORD_LINK, chat_link, should_notify


async def _token(client: AsyncClient, email: str = "a@b.com") -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": email, "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _user_id(client: AsyncClient, token: str) -> str:
    return (await client.get("/api/me", headers=_h(token))).json()["id"]


async def _make_goal(client: AsyncClient, token: str, name: str = "Buddy") -> str:
    res = await client.post("/api/goals", headers=_h(token), data={"name": name, "title": "T"})
    return res.json()["id"]


# ── 설정 기반 발송 판단 (순수) ──


def test_should_notify_respects_toggles():
    s = UserSettings.defaults("u1")
    assert should_notify(s, "todoAdded") is True

    s.notif_todo = False
    assert should_notify(s, "todoAdded") is False  # todo 토글 off
    assert should_notify(s, "nudge") is True  # 다른 종류는 영향 없음

    s.notif_enabled = False
    assert should_notify(s, "nudge") is False  # 전체 off 면 전부 차단


def test_should_notify_dnd_window():
    s = UserSettings.defaults("u1")
    s.dnd_enabled = True
    s.dnd_start_hour = 23
    s.dnd_end_hour = 7  # 자정 넘김
    assert should_notify(s, "todoIncomplete", now_hour=2) is False  # DnD 안
    assert should_notify(s, "todoIncomplete", now_hour=12) is True  # DnD 밖
    # now_hour 를 안 주면 DnD 무시(즉시 알림)
    assert should_notify(s, "todoIncomplete") is True


# ── 홈 미리보기 ──


async def test_home_previews_unread_only_one_per_goal(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    g1 = await _make_goal(client, token, "A")
    await _make_goal(client, token, "B")  # 메시지 없음 → 미리보기 없음

    async with session_factory() as s:
        base = datetime(2026, 8, 3, tzinfo=UTC)
        # g1: assistant 메시지 2개(안 읽음)
        s.add(Message(goal_id=g1, role="assistant", content="옛날", created_at=base))
        s.add(
            Message(
                goal_id=g1,
                role="assistant",
                content="최신 안읽음",
                created_at=base + timedelta(hours=1),
            )
        )
        await s.commit()

    res = await client.get("/api/home/previews", headers=_h(token))
    body = res.json()
    assert len(body) == 1  # 목표당 한 장, g2 는 제외
    assert body[0]["kind"] == "message"
    assert body[0]["title"] == "A"
    assert body[0]["content"] == "최신 안읽음"
    assert body[0]["linkTo"] == chat_link(g1)


async def test_home_previews_excludes_read(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    g = await _make_goal(client, token)

    async with session_factory() as s:
        s.add(
            Message(
                goal_id=g,
                role="assistant",
                content="읽을 거야",
                created_at=datetime(2026, 8, 3, tzinfo=UTC),
            )
        )
        await s.commit()

    # 읽음 처리 → 미리보기에서 사라짐
    await client.post(f"/api/goals/{g}/read", headers=_h(token))
    res = await client.get("/api/home/previews", headers=_h(token))
    assert res.json() == []


# ── 알림 목록·읽음 ──


async def test_notifications_list_and_read(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    uid = await _user_id(client, token)

    async with session_factory() as s:
        base = datetime(2026, 8, 3, tzinfo=UTC)
        for i in range(7):  # 7개 넣어도 최대 5개만 내려온다
            s.add(
                Notification(
                    user_id=uid,
                    type="todoAdded",
                    title="Buddy",
                    body=f"n{i}",
                    link_to=RECORD_LINK,
                    created_at=base + timedelta(minutes=i),
                )
            )
        await s.commit()

    listed = await client.get("/api/notifications", headers=_h(token))
    body = listed.json()
    assert len(body) == 5  # 최대 5
    assert body[0]["body"] == "n6"  # 최신순
    assert all(n["isRead"] is False for n in body)

    # 전체 읽음
    assert (await client.post("/api/notifications/read", headers=_h(token))).status_code == 204
    after = await client.get("/api/notifications", headers=_h(token))
    assert all(n["isRead"] is True for n in after.json())


async def test_notifications_isolated_by_user(
    client: AsyncClient, session_factory: async_sessionmaker
):
    t1 = await _token(client, "u1@b.com")
    t2 = await _token(client, "u2@b.com")
    uid1 = await _user_id(client, t1)

    async with session_factory() as s:
        s.add(Notification(user_id=uid1, type="todoAdded", title="x", body="mine"))
        await s.commit()

    assert (await client.get("/api/notifications", headers=_h(t2))).json() == []


# ── AI 도구 → 알림 연동 ──


async def test_ai_create_todos_makes_notification(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        await dispatch_tool_call(
            s, goal, "create_todos", {"date": "2026-08-03", "items": [{"content": "3강"}]}
        )

    res = await client.get("/api/notifications", headers=_h(token))
    body = res.json()
    assert len(body) == 1
    assert body[0]["type"] == "todoAdded"
    assert body[0]["linkTo"] == chat_link(goal_id)


async def test_ai_todo_notification_suppressed_when_toggle_off(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)
    uid = await _user_id(client, token)

    # 투두 알림 토글 off
    async with session_factory() as s:
        settings = await s.get(UserSettings, uid)
        settings.notif_todo = False
        await s.commit()

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        await dispatch_tool_call(
            s, goal, "create_todos", {"date": "2026-08-03", "items": [{"content": "3강"}]}
        )

    # 투두는 만들어지되 알림은 안 생김
    assert (await client.get("/api/notifications", headers=_h(token))).json() == []
    todos = await client.get("/api/todos", headers=_h(token), params={"date": "2026-08-03"})
    assert len(todos.json()) == 1
