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
