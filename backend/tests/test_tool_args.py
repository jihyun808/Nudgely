"""도구 인자 검증 (B-4).

모델이 보내는 인자는 신뢰할 수 없다. 실제로 create_todos 의 date 를 2023-10-01 로
찍어 화면에 영영 안 보이는 날짜에 저장된 적이 있다.

핵심 규칙: **잘못된 인자로 대화가 끊기면 안 된다.** 디스패처는 예외를 밖으로
내보내지 않고, 사유를 문자열로 돌려 모델이 고쳐 부르게 한다.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.tools import dispatch_tool_call
from app.models.goal import Goal
from app.models.planner import PlannerBlock
from app.models.todo import Todo


async def _goal(client: AsyncClient, session_factory: async_sessionmaker) -> Goal:
    token = (
        await client.post(
            "/api/auth/signup",
            json={"nickname": "지수", "email": "t@b.com", "password": "password123"},
        )
    ).json()["accessToken"]
    goal_id = (
        await client.post(
            "/api/goals",
            headers={"Authorization": f"Bearer {token}"},
            data={"name": "Buddy", "title": "UIUX"},
        )
    ).json()["id"]
    async with session_factory() as db:
        return await db.get(Goal, goal_id)


async def _call(session_factory, goal: Goal, name: str, args: dict) -> str:
    async with session_factory() as db:
        return await dispatch_tool_call(db, await db.get(Goal, goal.id), name, args)


@pytest.mark.parametrize(
    ("args", "hint"),
    [
        ({"items": [{"content": "1강"}]}, "YYYY-MM-DD"),  # date 없음
        ({"date": "내일", "items": [{"content": "1강"}]}, "날짜 형식"),
        ({"date": "2026-13-45", "items": [{"content": "1강"}]}, "날짜 형식"),
        ({"date": "2026-09-20", "items": []}, "비어 있지 않은 배열"),
        ({"date": "2026-09-20", "items": [{}]}, "content"),
        ({"date": "2026-09-20", "items": [{"content": "  "}]}, "content"),
        (
            {"date": "2026-09-20", "items": [{"content": "1강", "progressDelta": "3강"}]},
            "정수",
        ),
    ],
)
async def test_create_todos_rejects_bad_args(
    client: AsyncClient, session_factory: async_sessionmaker, args: dict, hint: str
):
    goal = await _goal(client, session_factory)
    out = await _call(session_factory, goal, "create_todos", args)

    assert "잘못됐다" in out, out
    assert hint in out, out
    # 아무것도 저장되지 않아야 한다
    async with session_factory() as db:
        assert (await db.execute(select(Todo))).scalars().all() == []


async def test_create_todos_caps_item_count(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """한 번에 수십 개를 쏟아붓지 못하게 막는다."""
    goal = await _goal(client, session_factory)
    items = [{"content": f"{i}강"} for i in range(50)]
    out = await _call(session_factory, goal, "create_todos", {"date": "2026-09-20", "items": items})
    assert "너무 많다" in out


async def test_planner_rejects_out_of_range_time(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """자정 기준 분이라 0~1439 밖은 표에 그릴 수 없다."""
    goal = await _goal(client, session_factory)
    out = await _call(
        session_factory,
        goal,
        "create_planner",
        {
            "date": "2026-09-20",
            "blocks": [{"title": "공부", "startMinutes": 1500, "durationMinutes": 30}],
        },
    )
    assert "0~1439" in out
    async with session_factory() as db:
        assert (await db.execute(select(PlannerBlock))).scalars().all() == []


async def test_planner_rejects_block_past_midnight(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """23:30 에 시작하는 2시간짜리는 하루를 넘는다."""
    goal = await _goal(client, session_factory)
    out = await _call(
        session_factory,
        goal,
        "create_planner",
        {
            "date": "2026-09-20",
            "blocks": [{"title": "공부", "startMinutes": 23 * 60 + 30, "durationMinutes": 120}],
        },
    )
    assert "자정을 넘는다" in out


async def test_milestones_reject_unknown_status(
    client: AsyncClient, session_factory: async_sessionmaker
):
    goal = await _goal(client, session_factory)
    out = await _call(
        session_factory,
        goal,
        "set_milestones",
        {"milestones": [{"title": "1장", "status": "진행중"}]},
    )
    assert "done|current|upcoming" in out


async def test_check_todo_item_without_id(client: AsyncClient, session_factory: async_sessionmaker):
    goal = await _goal(client, session_factory)
    out = await _call(session_factory, goal, "check_todo_item", {})
    assert "itemId" in out


async def test_valid_args_still_work(client: AsyncClient, session_factory: async_sessionmaker):
    """검증을 넣었다고 정상 호출이 막히면 안 된다."""
    goal = await _goal(client, session_factory)
    out = await _call(
        session_factory,
        goal,
        "create_todos",
        {"date": "2026-09-20", "items": [{"content": "1강 듣기", "progressDelta": 1}]},
    )
    assert "잘못됐다" not in out
    async with session_factory() as db:
        assert len((await db.execute(select(Todo))).scalars().all()) == 1


async def test_unknown_tool_does_not_raise(
    client: AsyncClient, session_factory: async_sessionmaker
):
    goal = await _goal(client, session_factory)
    out = await _call(session_factory, goal, "지어낸_도구", {})
    assert "알 수 없는 도구" in out


# ── set_progress 는 '없으면 null' 이어야 한다 (api.md §3.1) ──


async def test_empty_set_progress_is_rejected(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """인자 없는 호출이 진도를 만들어내면 안 된다.

    {current:0, total:0, unit:''} 은 프론트에서 truthy 라, 진도가 없던 목표의
    카드가 '시작일 안내' 대신 '0 / 0 완료' 0% 막대로 바뀐다.
    """
    goal = await _goal(client, session_factory)
    out = await _call(session_factory, goal, "set_progress", {})

    assert "최소 하나는 있어야 한다" in out
    async with session_factory() as db:
        assert (await db.get(Goal, goal.id)).progress is None


async def test_set_progress_rejects_zero_total(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """total=0 이면 상한 검사가 무력해져 '30강 중 45강' 이 생긴다."""
    goal = await _goal(client, session_factory)
    out = await _call(session_factory, goal, "set_progress", {"total": 0, "unit": "강"})

    assert "1~100000" in out
    async with session_factory() as db:
        assert (await db.get(Goal, goal.id)).progress is None


async def test_set_progress_partial_update_works(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """일부만 보내는 건 정상이다(진도 보정)."""
    goal = await _goal(client, session_factory)
    await _call(session_factory, goal, "set_progress", {"total": 30, "unit": "강"})
    await _call(session_factory, goal, "set_progress", {"current": 3})

    async with session_factory() as db:
        assert (await db.get(Goal, goal.id)).progress == {
            "current": 3,
            "total": 30,
            "unit": "강",
        }


async def test_milestones_can_be_cleared(client: AsyncClient, session_factory: async_sessionmaker):
    """통째로 교체하는 도구라 빈 배열은 '전부 지우기' 다."""
    goal = await _goal(client, session_factory)
    await _call(session_factory, goal, "set_milestones", {"milestones": [{"title": "1장"}]})
    out = await _call(session_factory, goal, "set_milestones", {"milestones": []})

    assert "잘못됐다" not in out
    assert "0개" in out


# ── 목표 세우기 도구 (1단계) ──


async def test_due_date_can_be_set_and_cleared(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """기한을 대화로만 알고 넘기면 다음 턴에 잊는다. 저장할 수 있어야 한다."""
    goal = await _goal(client, session_factory)

    out = await _call(session_factory, goal, "set_due_date", {"date": "2026-10-20"})
    assert "2026-10-20" in out
    async with session_factory() as db:
        assert str((await db.get(Goal, goal.id)).due_date) == "2026-10-20"

    await _call(session_factory, goal, "set_due_date", {})
    async with session_factory() as db:
        assert (await db.get(Goal, goal.id)).due_date is None


async def test_routine_is_saved(client: AsyncClient, session_factory: async_sessionmaker):
    """'매일 1소주제' 를 저장해 둬야 다음날 먼저 제안할 수 있다."""
    from app.models.routine import Routine

    goal = await _goal(client, session_factory)

    out = await _call(
        session_factory,
        goal,
        "set_routine",
        {
            "items": [
                {"content": "수업", "durationMinutes": 45, "progressDelta": 0},
                {"content": "정리", "durationMinutes": 15, "progressDelta": 1},
            ]
        },
    )

    assert "2개" in out
    async with session_factory() as db:
        rows = (await db.execute(select(Routine).order_by(Routine.order))).scalars().all()
    assert [r.content for r in rows] == ["수업", "정리"]
    assert rows[1].progress_delta == 1


async def test_routine_weekdays_are_validated(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """요일은 월=0…일=6 숫자만. 아무 문자열이나 들어가면 판정이 깨진다."""
    goal = await _goal(client, session_factory)

    out = await _call(
        session_factory,
        goal,
        "set_routine",
        {"items": [{"content": "수업", "weekdays": "월수금"}]},
    )
    assert "월=0" in out


async def test_routine_can_be_emptied(client: AsyncClient, session_factory: async_sessionmaker):
    from app.models.routine import Routine

    goal = await _goal(client, session_factory)
    await _call(session_factory, goal, "set_routine", {"items": [{"content": "수업"}]})

    out = await _call(session_factory, goal, "set_routine", {"items": []})

    assert "비웠다" in out
    async with session_factory() as db:
        assert (await db.execute(select(Routine))).scalars().all() == []
