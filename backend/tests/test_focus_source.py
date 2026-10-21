"""집중 시간은 플래너 실제 기록 하나에서 센다.

사용자가 플래너에서 고친 값이 요약·히트맵·주간 그래프·목표 진도에 그대로 나와야 한다.
"""

from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.services.planner_service import add_block
from tests.helpers import auth, create_goal, token_for

DATE = "2026-08-03"  # 월요일


async def _save(client, token, *, seconds, started_at, goal_id=None):
    body = {"mode": "stopwatch", "seconds": seconds, "startedAt": started_at, "goalId": goal_id}
    return await client.post("/api/focus/sessions", headers=auth(token), json=body)


async def _planner(client, token, day=DATE) -> dict:
    res = await client.get("/api/planners", headers=auth(token), params={"date": day})
    return res.json()


async def _focused_seconds(client, token) -> int:
    res = await client.get("/api/focus/summary", headers=auth(token), params={"date": DATE})
    return res.json()["focusedSeconds"]


async def test_planner_edit_shows_everywhere(client: AsyncClient):
    token = await token_for(client)
    goal_id = await create_goal(client, token)
    await _save(client, token, seconds=1500, started_at="2026-08-03T01:00:00Z", goal_id=goal_id)
    block = (await _planner(client, token))["actual"][0]

    await client.patch(
        f"/api/planners/{DATE}/actual/{block['id']}",
        headers=auth(token),
        json={"title": block["title"], "startMinutes": 600, "durationMinutes": 10},
    )

    assert await _focused_seconds(client, token) == 600
    daily = await client.get(
        "/api/focus/daily", headers=auth(token), params={"from": DATE, "to": DATE}
    )
    assert daily.json()["days"] == [{"date": DATE, "seconds": 600}]
    weekly = await client.get("/api/focus/weekly", headers=auth(token), params={"weekStart": DATE})
    assert weekly.json()["hours"][0] == 0.2
    progress = await client.get(f"/api/goals/{goal_id}/progress", headers=auth(token))
    assert progress.json()["focusedSeconds"] == 600

    await client.delete(f"/api/planners/{DATE}/actual/{block['id']}", headers=auth(token))
    assert await _focused_seconds(client, token) == 0


async def test_manual_record_counts_as_focus(client: AsyncClient):
    token = await token_for(client)
    await client.post(
        f"/api/planners/{DATE}/actual",
        headers=auth(token),
        json={"title": "도서관", "startMinutes": 540, "durationMinutes": 60},
    )

    assert await _focused_seconds(client, token) == 3600


async def test_session_past_midnight_splits_into_next_day(client: AsyncClient):
    token = await token_for(client)
    # 한국 시각 23:30 부터 2시간
    await _save(client, token, seconds=7200, started_at="2026-08-03T14:30:00Z")

    today = (await _planner(client, token))["actual"]
    tomorrow = (await _planner(client, token, "2026-08-04"))["actual"]
    assert [(b["startMinutes"], b["durationMinutes"]) for b in today] == [(1410, 30)]
    assert [(b["startMinutes"], b["durationMinutes"]) for b in tomorrow] == [(0, 90)]


async def test_verified_record_time_is_locked(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await token_for(client)
    user_id = (await client.get("/api/me", headers=auth(token))).json()["id"]
    async with session_factory() as db:
        block = await add_block(
            db,
            user_id,
            date(2026, 8, 3),
            title="집중 인증",
            start_minutes=600,
            duration_minutes=30,
            kind="verify",
        )
        await db.commit()
    url = f"/api/planners/{DATE}/actual/{block.id}"

    longer = await client.patch(
        url,
        headers=auth(token),
        json={"title": "집중 인증", "startMinutes": 600, "durationMinutes": 120},
    )
    renamed = await client.patch(
        url, headers=auth(token), json={"title": "수학", "startMinutes": 600, "durationMinutes": 30}
    )

    assert longer.json()["code"] == "VERIFY_TIME_LOCKED"
    assert renamed.status_code == 200
    assert renamed.json()["actual"][0]["title"] == "수학"
