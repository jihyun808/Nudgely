"""밤 11시 점검 · 독촉(nudge) 로직 테스트."""

from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Goal
from app.services.notification_service import run_nightly_check, send_nudge
from app.services.planner_service import add_block
from app.services.record_service import create_daily_todo

ON = date(2026, 8, 3)


async def _token(client: AsyncClient, email: str = "a@b.com") -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": email, "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _make_goal(client: AsyncClient, token: str) -> str:
    res = await client.post("/api/goals", headers=_h(token), data={"name": "Buddy", "title": "T"})
    return res.json()["id"]


def _types(notifs: list[dict]) -> set[str]:
    return {n["type"] for n in notifs}


async def test_nightly_incomplete_todo_and_empty_planner(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        # 미완료 투두 1개, 플래너는 비어 있음
        await create_daily_todo(s, goal, ON, [{"content": "미완료"}])
        await s.commit()

    async with session_factory() as s:
        created = await run_nightly_check(s, ON, now_hour=23)
        await s.commit()
    assert created == 2

    notifs = (await client.get("/api/notifications", headers=_h(token))).json()
    assert _types(notifs) == {"todoIncomplete", "plannerIncomplete"}


async def test_nightly_no_todoincomplete_when_all_done_and_plan_exists(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    uid = (await client.get("/api/me", headers=_h(token))).json()["id"]
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        todo = await create_daily_todo(s, goal, ON, [{"content": "완료됨"}])
        todo.items[0].is_done = True
        # 플래너 계획 존재
        await add_block(s, uid, ON, title="공부", start_minutes=480, duration_minutes=60)
        await s.commit()

    async with session_factory() as s:
        created = await run_nightly_check(s, ON, now_hour=23)
        await s.commit()
    assert created == 0
    assert (await client.get("/api/notifications", headers=_h(token))).json() == []


async def test_nightly_respects_deadline_toggle(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    uid = (await client.get("/api/me", headers=_h(token))).json()["id"]
    goal_id = await _make_goal(client, token)

    from app.models.user import UserSettings

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        await create_daily_todo(s, goal, ON, [{"content": "미완료"}])
        settings = await s.get(UserSettings, uid)
        settings.notif_deadline = False  # 마감 리마인더 끔
        await s.commit()

    async with session_factory() as s:
        created = await run_nightly_check(s, ON, now_hour=23)
        await s.commit()
    assert created == 0


async def test_nightly_skips_users_without_active_goal(
    client: AsyncClient, session_factory: async_sessionmaker
):
    await _token(client)  # 목표 없는 사용자
    async with session_factory() as s:
        created = await run_nightly_check(s, ON, now_hour=23)
        await s.commit()
    assert created == 0


async def test_send_nudge_creates_message_and_notification(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        msg = await send_nudge(s, goal, "오늘 UI/UX 5강 남았어!")
        await s.commit()
    assert msg is not None

    # 채팅방에 assistant 메시지가 남는다
    msgs = (await client.get(f"/api/goals/{goal_id}/messages", headers=_h(token))).json()
    assert msgs["messages"][0]["content"] == "오늘 UI/UX 5강 남았어!"

    # nudge 알림 생성
    notifs = (await client.get("/api/notifications", headers=_h(token))).json()
    assert notifs[0]["type"] == "nudge"
    assert notifs[0]["linkTo"] == f"/chat/{goal_id}"


async def test_send_nudge_skips_muted_goal(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)
    await client.patch(
        f"/api/goals/{goal_id}", headers=_h(token), json={"isNotificationMuted": True}
    )

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        msg = await send_nudge(s, goal, "독촉!")
        await s.commit()
    assert msg is None
    assert (await client.get("/api/notifications", headers=_h(token))).json() == []
