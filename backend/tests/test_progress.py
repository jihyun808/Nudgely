"""모아보기 진도(GET /goals/{id}/progress) 테스트."""

from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Goal
from app.services.progress_service import set_milestones
from app.services.record_service import create_daily_todo


async def _token(client: AsyncClient, email: str = "a@b.com") -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": email, "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _make_goal(client: AsyncClient, token: str, title: str = "UI/UX 완주") -> str:
    res = await client.post("/api/goals", headers=_h(token), data={"name": "Buddy", "title": title})
    return res.json()["id"]


async def test_progress_empty(client: AsyncClient):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    res = await client.get(f"/api/goals/{goal_id}/progress", headers=_h(token))
    assert res.status_code == 200
    body = res.json()
    assert body["goalId"] == goal_id
    assert body["goalTitle"] == "UI/UX 완주"
    assert body["startedAt"] is not None
    assert body["completedAt"] is None
    assert body["milestones"] == []
    # 완료 투두 없음 → 생략(None)
    assert body["completedTodoCount"] is None
    assert body["bestMonth"] is None


async def test_progress_with_milestones_and_counts(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        await set_milestones(
            s,
            goal,
            [
                {"title": "6월까지 기초 10강", "status": "done"},
                {"title": "7월까지 20강", "status": "current"},
                {"title": "8월 완주", "status": "upcoming"},
            ],
        )
        todo = await create_daily_todo(
            s, goal, date(2026, 8, 3), [{"content": "a"}, {"content": "b"}]
        )
        todo.items[0].is_done = True  # 완료 1개
        await s.commit()

    res = await client.get(f"/api/goals/{goal_id}/progress", headers=_h(token))
    body = res.json()

    titles = [m["title"] for m in body["milestones"]]
    assert titles == ["6월까지 기초 10강", "7월까지 20강", "8월 완주"]
    assert body["milestones"][0]["status"] == "done"
    assert body["completedTodoCount"] == 1
    assert body["bestMonth"] == "2026-08"


async def test_progress_completed_goal(client: AsyncClient):
    token = await _token(client)
    goal_id = await _make_goal(client, token)
    await client.post(f"/api/goals/{goal_id}/complete", headers=_h(token))

    res = await client.get(f"/api/goals/{goal_id}/progress", headers=_h(token))
    assert res.json()["completedAt"] is not None


async def test_progress_other_user_404(client: AsyncClient):
    t1 = await _token(client, "u1@b.com")
    t2 = await _token(client, "u2@b.com")
    goal_id = await _make_goal(client, t1)

    res = await client.get(f"/api/goals/{goal_id}/progress", headers=_h(t2))
    assert res.status_code == 404
    assert res.json()["code"] == "GOAL_NOT_FOUND"


# ── bestMonth: 완료한 할 일이 가장 많았던 달 ──


async def _seed(session_factory, goal_id: str, per_day: dict) -> None:
    """{날짜: (전체 개수, 완료 개수)} 대로 투두를 만든다."""
    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        for day, (total, done) in per_day.items():
            todo = await create_daily_todo(
                s, goal, day, [{"content": f"item {i}"} for i in range(total)]
            )
            for item in todo.items[:done]:
                item.is_done = True
        await s.commit()


async def _best_month(client: AsyncClient, token: str, goal_id: str) -> str | None:
    res = await client.get(f"/api/goals/{goal_id}/progress", headers=_h(token))
    return res.json()["bestMonth"]


async def test_best_month_picks_the_month_with_most_done(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)
    await _seed(
        session_factory,
        goal_id,
        {
            date(2026, 7, 10): (3, 3),  # 7월 완료 3 + 2 = 5
            date(2026, 7, 20): (2, 2),
            date(2026, 8, 3): (4, 2),  # 8월 완료 2
        },
    )
    assert await _best_month(client, token, goal_id) == "2026-07"


async def test_best_month_ignores_unfinished_items(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """할 일을 많이 만든 달이 아니라, 많이 '끝낸' 달이어야 한다."""
    token = await _token(client)
    goal_id = await _make_goal(client, token)
    await _seed(
        session_factory,
        goal_id,
        {
            date(2026, 7, 10): (9, 1),  # 많이 만들었지만 1개만 완료
            date(2026, 8, 3): (2, 2),
        },
    )
    assert await _best_month(client, token, goal_id) == "2026-08"


async def test_best_month_is_none_without_any_completion(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)
    await _seed(session_factory, goal_id, {date(2026, 7, 10): (3, 0)})
    assert await _best_month(client, token, goal_id) is None


async def test_best_month_breaks_ties_with_the_recent_month(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)
    await _seed(
        session_factory,
        goal_id,
        {date(2026, 7, 10): (2, 2), date(2026, 9, 3): (2, 2)},
    )
    assert await _best_month(client, token, goal_id) == "2026-09"


async def test_best_month_counts_only_this_goal(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    mine = await _make_goal(client, token, "내 목표")
    other = await _make_goal(client, token, "다른 목표")

    await _seed(session_factory, mine, {date(2026, 7, 10): (2, 2)})
    await _seed(session_factory, other, {date(2026, 8, 3): (5, 5)})

    assert await _best_month(client, token, mine) == "2026-07"
    assert await _best_month(client, token, other) == "2026-08"
