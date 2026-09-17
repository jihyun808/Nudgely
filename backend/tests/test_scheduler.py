"""밤 11시 점검 · 독촉(nudge) 로직 테스트.

점검은 사용자 로컬 시각 기준이라, 테스트는 "그 사람의 밤 11시" 에 해당하는
UTC 시각을 넣어준다. 기본 타임존은 Asia/Seoul 이므로 KST 23시 == UTC 14시.
"""

from datetime import UTC, date, datetime

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Goal
from app.services.notification_service import run_nightly_check, send_nudge
from app.services.planner_service import add_block
from app.services.record_service import create_daily_todo

ON = date(2026, 8, 3)
# 한국 2026-08-03 23:00 == UTC 같은 날 14:00
KST_11PM = datetime(2026, 8, 3, 14, tzinfo=UTC)


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
        created = await run_nightly_check(s, KST_11PM)
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
        created = await run_nightly_check(s, KST_11PM)
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
        created = await run_nightly_check(s, KST_11PM)
        await s.commit()
    assert created == 0


async def test_nightly_skips_users_without_active_goal(
    client: AsyncClient, session_factory: async_sessionmaker
):
    await _token(client)  # 목표 없는 사용자
    async with session_factory() as s:
        created = await run_nightly_check(s, KST_11PM)
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


# ── 사용자 로컬 타임존 기준 실행 ──


async def _seed_incomplete(client: AsyncClient, session_factory, token: str) -> None:
    """미완료 투두 1개 + 빈 플래너 상태를 만든다."""
    goal_id = await _make_goal(client, token)
    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        await create_daily_todo(s, goal, ON, [{"content": "미완료"}])
        await s.commit()


async def _set_timezone(client: AsyncClient, token: str, tz: str) -> None:
    res = await client.patch("/api/settings", headers=_h(token), json={"timezone": tz})
    assert res.status_code == 200, res.text
    assert res.json()["timezone"] == tz


async def test_nightly_does_nothing_outside_the_users_11pm(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    await _seed_incomplete(client, session_factory, token)

    # UTC 로는 23시지만 한국은 아침 8시 — 예전 동작이라면 여기서 알림이 갔다
    async with session_factory() as s:
        created = await run_nightly_check(s, datetime(2026, 8, 3, 23, tzinfo=UTC))
        await s.commit()

    assert created == 0
    assert (await client.get("/api/notifications", headers=_h(token))).json() == []


async def test_nightly_follows_each_users_own_timezone(
    client: AsyncClient, session_factory: async_sessionmaker
):
    seoul = await _token(client, "seoul@b.com")
    await _seed_incomplete(client, session_factory, seoul)

    ny = await _token(client, "ny@b.com")
    await _seed_incomplete(client, session_factory, ny)
    await _set_timezone(client, ny, "America/New_York")

    # UTC 14시 == 서울 23시 / 뉴욕 오전 10시
    async with session_factory() as s:
        created = await run_nightly_check(s, KST_11PM)
        await s.commit()
    assert created == 2
    assert _types((await client.get("/api/notifications", headers=_h(seoul))).json()) == {
        "todoIncomplete",
        "plannerIncomplete",
    }
    assert (await client.get("/api/notifications", headers=_h(ny))).json() == []

    # UTC 다음날 03시 == 뉴욕 23시 (EDT)
    async with session_factory() as s:
        created = await run_nightly_check(s, datetime(2026, 8, 4, 3, tzinfo=UTC))
        await s.commit()
    assert created == 2
    assert len((await client.get("/api/notifications", headers=_h(ny))).json()) == 2


async def test_nightly_sends_once_even_though_it_runs_hourly(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """스케줄러가 매시간 깨어나므로 같은 날 중복 발송을 막아야 한다."""
    token = await _token(client)
    await _seed_incomplete(client, session_factory, token)

    async with session_factory() as s:
        assert await run_nightly_check(s, KST_11PM) == 2
        await s.commit()

    # 같은 로컬 시각에 또 깨어나도(재시작·서머타임) 두 번 만들지 않는다
    async with session_factory() as s:
        assert await run_nightly_check(s, KST_11PM) == 0
        await s.commit()

    assert len((await client.get("/api/notifications", headers=_h(token))).json()) == 2


async def test_nightly_uses_the_users_local_date(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """한국 23시는 UTC 로 같은 날 14시지만, 날짜 판단은 그 사람 기준이어야 한다."""
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        # 8/3 은 전부 완료, 8/4 에 미완료가 있다
        todo = await create_daily_todo(s, goal, ON, [{"content": "완료됨"}])
        todo.items[0].is_done = True
        await create_daily_todo(s, goal, date(2026, 8, 4), [{"content": "내일 것"}])
        await s.commit()

    # 한국 8/3 23시 → 8/3 기준으로 보므로 미완료 투두 알림은 없어야 한다
    async with session_factory() as s:
        await run_nightly_check(s, KST_11PM)
        await s.commit()

    assert _types((await client.get("/api/notifications", headers=_h(token))).json()) == {
        "plannerIncomplete"
    }
