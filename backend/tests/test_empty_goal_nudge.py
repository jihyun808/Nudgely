"""비어 있는 목표에 AI 가 먼저 묻는다.

반복 계획이 있으면 아침에 투두가 자동으로 생기지만, 그게 없는 목표는
사용자가 앱을 열어야만 아무 일도 시작되지 않는다.
"""

from datetime import UTC, date, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.models.goal import Goal, Message
from app.services.nudge_service import NudgeContext, run_empty_goal_nudges
from app.services.planner_service import add_block
from app.services.record_service import create_daily_todo
from tests.helpers import create_goal, token_for

ON = date(2026, 10, 2)


def _kst(hour: int) -> datetime:
    return datetime(ON.year, ON.month, ON.day, hour, 0, tzinfo=UTC) - timedelta(hours=9)


HOURS = (8, 12, 17)


async def _run(session_factory, at: datetime) -> int:
    async with session_factory() as db:
        sent = await run_empty_goal_nudges(db, at, target_hours=HOURS)
        await db.commit()
        return sent


async def _messages(session_factory) -> list[str]:
    async with session_factory() as db:
        rows = await db.execute(select(Message).where(Message.role == "assistant"))
        return [m.content for m in rows.scalars().all()]


async def test_asks_what_to_do_when_there_is_no_todo(client: AsyncClient, session_factory):
    await create_goal(client, await token_for(client, "m1@b.com"), name="선대냥이")

    assert await _run(session_factory, _kst(8)) == 1
    assert "뭘 해볼까" in (await _messages(session_factory))[0]


async def test_asks_what_time_when_there_is_no_plan(client: AsyncClient, session_factory):
    """할 일은 있는데 시간표가 비었으면 시간을 묻는다."""
    token = await token_for(client, "m2@b.com")
    goal_id = await create_goal(client, token)
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        await create_daily_todo(db, goal, ON, [{"content": "1강 듣기"}])
        await db.commit()

    assert await _run(session_factory, _kst(8)) == 1
    assert "몇 시에" in (await _messages(session_factory))[0]


async def test_silent_when_both_are_filled(client: AsyncClient, session_factory):
    token = await token_for(client, "m3@b.com")
    goal_id = await create_goal(client, token)
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        await create_daily_todo(db, goal, ON, [{"content": "1강 듣기"}])
        await add_block(
            db,
            goal.user_id,
            ON,
            title="1강",
            start_minutes=540,
            duration_minutes=60,
            goal_id=goal_id,
        )
        await db.commit()

    assert await _run(session_factory, _kst(8)) == 0


async def test_only_at_the_target_hours(client: AsyncClient, session_factory):
    await create_goal(client, await token_for(client, "m4@b.com"))

    assert await _run(session_factory, _kst(15)) == 0


async def test_asked_once_per_hour_slot(client: AsyncClient, session_factory):
    """스케줄러는 10분마다 돈다. 같은 시각을 여러 번 지나도 한 번이어야 한다."""
    await create_goal(client, await token_for(client, "m5@b.com"))

    await _run(session_factory, _kst(8))
    await _run(session_factory, _kst(8))

    assert len(await _messages(session_factory)) == 1


async def test_asks_again_at_the_next_slot(client: AsyncClient, session_factory):
    """아침에 흘려보냈어도 점심에 한 번 더 기회가 생긴다."""
    await create_goal(client, await token_for(client, "m8@b.com"))

    await _run(session_factory, _kst(8))
    await _run(session_factory, _kst(12))

    assert len(await _messages(session_factory)) == 2


async def test_all_three_slots_send_when_still_empty(client: AsyncClient, session_factory):
    """하루 종일 비워두면 세 번 다 간다. 상한에 막히면 안 된다."""
    await create_goal(client, await token_for(client, "m9@b.com"))

    for hour in HOURS:
        await _run(session_factory, _kst(hour))

    assert len(await _messages(session_factory)) == len(HOURS)


async def test_muted_goal_is_skipped(client: AsyncClient, session_factory):
    token = await token_for(client, "m6@b.com")
    goal_id = await create_goal(client, token)
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        goal.is_notification_muted = True
        await db.commit()

    assert await _run(session_factory, _kst(8)) == 0


async def test_writer_gets_what_is_missing(client: AsyncClient, session_factory):
    """AI 가 '뭐 할까' 와 '몇 시에 할까' 를 구분해 쓸 수 있어야 한다."""
    token = await token_for(client, "m7@b.com")
    goal_id = await create_goal(client, token)
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        await create_daily_todo(db, goal, ON, [{"content": "1강 듣기"}])
        await db.commit()
    seen: list[NudgeContext] = []

    async def writer(ctx: NudgeContext) -> str:
        seen.append(ctx)
        return "확인"

    async with session_factory() as db:
        await run_empty_goal_nudges(db, _kst(8), target_hours=HOURS, writer=writer)
        await db.commit()

    assert seen[0].kind == "no_plan"
    assert seen[0].remaining == ["1강 듣기"]
