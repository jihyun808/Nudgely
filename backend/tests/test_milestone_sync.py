"""마일스톤 자동 진행 (B-3).

진도(current/total)가 움직이면 로드맵 단계도 따라간다.
'진도가 진실' 이고, AI 가 준 status 는 진도가 아직 없을 때만 유효하다.
"""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.tools import dispatch_tool_call
from app.models.goal import Goal
from app.models.milestone import Milestone

CHAPTERS = [{"title": f"{i}장"} for i in range(1, 5)]


async def _goal(client: AsyncClient, session_factory: async_sessionmaker) -> str:
    token = (
        await client.post(
            "/api/auth/signup",
            json={"nickname": "지수", "email": "ms@b.com", "password": "password123"},
        )
    ).json()["accessToken"]
    return (
        await client.post(
            "/api/goals",
            headers={"Authorization": f"Bearer {token}"},
            data={"name": "선대냥이", "title": "선형대수"},
        )
    ).json()["id"]


async def _call(session_factory, goal_id: str, name: str, args: dict) -> str:
    async with session_factory() as db:
        return await dispatch_tool_call(db, await db.get(Goal, goal_id), name, args)


async def _statuses(session_factory, goal_id: str) -> list[str]:
    async with session_factory() as db:
        rows = await db.execute(
            select(Milestone).where(Milestone.goal_id == goal_id).order_by(Milestone.order)
        )
        return [m.status for m in rows.scalars().all()]


async def test_equal_slices_when_no_target(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """target 이 없으면 균등 분할로 본다. 24개를 4단계로 → 6/12/18/24."""
    goal_id = await _goal(client, session_factory)
    await _call(session_factory, goal_id, "set_progress", {"total": 24, "unit": "소주제"})
    await _call(session_factory, goal_id, "set_milestones", {"milestones": CHAPTERS})

    # 7개 완료 → 1장(6)은 끝, 2장(12) 진행 중
    await _call(session_factory, goal_id, "set_progress", {"current": 7})

    assert await _statuses(session_factory, goal_id) == [
        "done",
        "current",
        "upcoming",
        "upcoming",
    ]


async def test_target_overrides_equal_slices(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """장마다 분량이 다르면 target 으로 정확히 잡는다."""
    goal_id = await _goal(client, session_factory)
    await _call(session_factory, goal_id, "set_progress", {"total": 24, "unit": "소주제"})
    await _call(
        session_factory,
        goal_id,
        "set_milestones",
        {
            "milestones": [
                {"title": "1장", "target": 3},
                {"title": "2장", "target": 5},
                {"title": "3장", "target": 15},
                {"title": "4장", "target": 24},
            ]
        },
    )

    await _call(session_factory, goal_id, "set_progress", {"current": 5})

    # 균등 분할이었다면 5는 아직 1장(6) 안이라 ['current',...] 였을 것
    assert await _statuses(session_factory, goal_id) == [
        "done",
        "done",
        "current",
        "upcoming",
    ]


async def test_milestones_follow_todo_check(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """투두를 체크해 진도가 오르면 단계도 따라 올라간다."""
    goal_id = await _goal(client, session_factory)
    await _call(session_factory, goal_id, "set_progress", {"total": 4, "unit": "장"})
    await _call(session_factory, goal_id, "set_milestones", {"milestones": CHAPTERS})
    assert (await _statuses(session_factory, goal_id))[0] == "current"

    out = await _call(
        session_factory,
        goal_id,
        "create_todos",
        {"date": "2026-09-20", "items": [{"content": "1장 끝내기", "progressDelta": 1}]},
    )
    item_id = out.split("itemId=")[1].split("(")[0]
    await _call(session_factory, goal_id, "check_todo_item", {"itemId": item_id})

    assert await _statuses(session_factory, goal_id) == [
        "done",
        "current",
        "upcoming",
        "upcoming",
    ]


async def test_unchecking_moves_milestones_back(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """잘못 체크했다 풀면 단계도 되돌아간다."""
    goal_id = await _goal(client, session_factory)
    await _call(session_factory, goal_id, "set_progress", {"total": 4, "unit": "장"})
    await _call(session_factory, goal_id, "set_milestones", {"milestones": CHAPTERS})

    out = await _call(
        session_factory,
        goal_id,
        "create_todos",
        {"date": "2026-09-20", "items": [{"content": "1장 끝내기", "progressDelta": 1}]},
    )
    item_id = out.split("itemId=")[1].split("(")[0]
    await _call(session_factory, goal_id, "check_todo_item", {"itemId": item_id})
    await _call(session_factory, goal_id, "check_todo_item", {"itemId": item_id, "done": False})

    assert (await _statuses(session_factory, goal_id))[0] == "current"


async def test_ai_status_kept_when_no_progress(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """진도가 아직 없으면 AI 가 지정한 status 를 건드리지 않는다."""
    goal_id = await _goal(client, session_factory)
    await _call(
        session_factory,
        goal_id,
        "set_milestones",
        {
            "milestones": [
                {"title": "1장", "status": "done"},
                {"title": "2장", "status": "current"},
                {"title": "3장"},
            ]
        },
    )

    assert await _statuses(session_factory, goal_id) == ["done", "current", "upcoming"]


async def test_progress_wins_over_ai_status(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """진도가 있으면 AI 가 준 status 보다 진도가 우선이다."""
    goal_id = await _goal(client, session_factory)
    await _call(session_factory, goal_id, "set_progress", {"total": 4, "current": 2, "unit": "장"})
    await _call(
        session_factory,
        goal_id,
        "set_milestones",
        {"milestones": [{"title": f"{i}장", "status": "upcoming"} for i in range(1, 5)]},
    )

    # 전부 upcoming 으로 줬지만 2/4 진도라 앞 두 단계는 끝난 것으로 잡힌다
    assert await _statuses(session_factory, goal_id) == [
        "done",
        "done",
        "current",
        "upcoming",
    ]
