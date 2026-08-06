"""집중 세션 저장 · 집계 테스트."""

from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Goal
from app.services.planner_service import add_block
from app.services.record_service import create_daily_todo


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


async def _save(client, token, *, seconds, started_at, mode="stopwatch", goal_id=None):
    body = {"mode": mode, "seconds": seconds, "startedAt": started_at}
    if goal_id:
        body["goalId"] = goal_id
    return await client.post("/api/focus/sessions", headers=_h(token), json=body)


async def test_save_session_and_summary_focused(client: AsyncClient):
    token = await _token(client)
    first = await _save(client, token, seconds=1500, started_at="2026-08-03T01:00:00Z")
    assert first.status_code == 204
    await _save(client, token, seconds=1500, started_at="2026-08-03T02:00:00Z", mode="pomodoro")

    res = await client.get("/api/focus/summary", headers=_h(token), params={"date": "2026-08-03"})
    assert res.status_code == 200
    assert res.json()["focusedSeconds"] == 3000


async def test_session_dedup(client: AsyncClient):
    token = await _token(client)
    a = await _save(client, token, seconds=1500, started_at="2026-08-03T01:00:00Z")
    b = await _save(client, token, seconds=1500, started_at="2026-08-03T01:00:00Z")  # 중복
    assert a.status_code == 204 and b.status_code == 204

    res = await client.get("/api/focus/summary", headers=_h(token), params={"date": "2026-08-03"})
    assert res.json()["focusedSeconds"] == 1500  # 한 번만 반영


async def test_invalid_mode(client: AsyncClient):
    token = await _token(client)
    res = await _save(client, token, seconds=100, started_at="2026-08-03T01:00:00Z", mode="nope")
    assert res.status_code == 422
    assert res.json()["code"] == "INVALID_FOCUS_MODE"


async def test_summary_target_minutes_from_planner(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    uid = await _user_id(client, token)
    async with session_factory() as s:
        # 계획 40 + 20 = 60분, 실제(actual)는 목표시간에서 제외
        await add_block(s, uid, date(2026, 8, 3), title="a", start_minutes=480, duration_minutes=40)
        await add_block(s, uid, date(2026, 8, 3), title="b", start_minutes=540, duration_minutes=20)
        await add_block(
            s,
            uid,
            date(2026, 8, 3),
            title="c",
            start_minutes=600,
            duration_minutes=99,
            kind="focus",
        )
        await s.commit()

    res = await client.get("/api/focus/summary", headers=_h(token), params={"date": "2026-08-03"})
    assert res.json()["targetMinutes"] == 60


async def test_streak_from_todo_done_days(client: AsyncClient, session_factory: async_sessionmaker):
    token = await _token(client)
    async with session_factory() as s:
        goal = Goal(user_id=await _user_id(client, token), name="G")
        s.add(goal)
        await s.flush()
        # 8/1, 8/2, 8/3 연속 완료 → streak 3
        for d in (date(2026, 8, 1), date(2026, 8, 2), date(2026, 8, 3)):
            todo = await create_daily_todo(s, goal, d, [{"content": "x"}])
            todo.items[0].is_done = True
        await s.commit()

    res = await client.get("/api/focus/summary", headers=_h(token), params={"date": "2026-08-03"})
    body = res.json()
    assert body["streakDays"] == 3
    assert body["bestStreakDays"] == 3
    assert body["isBestStreak"] is True


async def test_weekly(client: AsyncClient):
    token = await _token(client)
    # 이번 주(월=8/3) 화요일에 2시간(7200s)
    await _save(client, token, seconds=7200, started_at="2026-08-04T05:00:00Z")

    res = await client.get(
        "/api/focus/weekly", headers=_h(token), params={"weekStart": "2026-08-03"}
    )
    body = res.json()
    assert len(body["hours"]) == 7
    assert body["hours"][1] == 2.0  # 화요일
    assert body["diffFromLastWeek"] == 2.0


async def test_daily_heatmap(client: AsyncClient):
    token = await _token(client)
    await _save(client, token, seconds=3600, started_at="2026-08-03T05:00:00Z")
    await _save(client, token, seconds=1800, started_at="2026-08-05T05:00:00Z")

    res = await client.get(
        "/api/focus/daily", headers=_h(token), params={"from": "2026-08-01", "to": "2026-08-31"}
    )
    days = res.json()["days"]
    assert {d["date"]: d["seconds"] for d in days} == {
        "2026-08-03": 3600,
        "2026-08-05": 1800,
    }


async def test_goal_focused_seconds_in_progress(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = (
        await client.post("/api/goals", headers=_h(token), data={"name": "Buddy", "title": "T"})
    ).json()["id"]

    # 목표에 붙은 집중 세션
    await _save(client, token, seconds=5040, started_at="2026-08-03T05:00:00Z", goal_id=goal_id)

    res = await client.get(f"/api/goals/{goal_id}/progress", headers=_h(token))
    assert res.json()["focusedSeconds"] == 5040
