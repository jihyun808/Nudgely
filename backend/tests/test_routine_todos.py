"""반복 계획 → 아침에 오늘 투두 만들기.

채팅방에 들어와야만 투두가 생기면 앱을 안 연 날은 아무 일도 안 일어난다.
독촉이 가장 필요한 사람에게 밤 11시 점검도 못 간다.
"""

from datetime import UTC, date, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.models.goal import Goal
from app.models.routine import Routine
from app.models.todo import Todo
from app.services.record_service import create_daily_todo
from app.services.routine_service import run_routine_todos
from tests.helpers import create_goal, token_for

ON = date(2026, 9, 28)  # 월요일


def _kst(hour: int) -> datetime:
    return datetime(ON.year, ON.month, ON.day, hour, 0, tzinfo=UTC) - timedelta(hours=9)


async def _goal_with_routine(client, session_factory, *, email: str, weekdays: str = "") -> str:
    token = await token_for(client, email)
    goal_id = await create_goal(client, token, name="선대냥이")
    async with session_factory() as db:
        db.add(
            Routine(
                goal_id=goal_id,
                content="1강 듣기",
                progress_delta=1,
                duration_minutes=50,
                weekdays=weekdays,
                order=0,
            )
        )
        await db.commit()
    return goal_id


async def _run(session_factory, at: datetime) -> int:
    async with session_factory() as db:
        made = await run_routine_todos(db, at)
        await db.commit()
        return made


async def _items(session_factory, goal_id: str) -> list[str]:
    async with session_factory() as db:
        todo = (
            await db.execute(select(Todo).where(Todo.goal_id == goal_id, Todo.date == ON))
        ).scalar_one_or_none()
        return [i.content for i in todo.items] if todo else []


async def test_morning_creates_todays_todos(client: AsyncClient, session_factory):
    goal_id = await _goal_with_routine(client, session_factory, email="r1@b.com")

    assert await _run(session_factory, _kst(6)) == 1
    assert await _items(session_factory, goal_id) == ["1강 듣기"]


async def test_nothing_outside_the_morning(client: AsyncClient, session_factory):
    await _goal_with_routine(client, session_factory, email="r2@b.com")

    assert await _run(session_factory, _kst(14)) == 0


async def test_existing_todos_are_left_alone(client: AsyncClient, session_factory):
    """사용자가 어제 대화로 잡아 둔 오늘 할 일을 덮으면 안 된다."""
    goal_id = await _goal_with_routine(client, session_factory, email="r3@b.com")
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        await create_daily_todo(db, goal, ON, [{"content": "직접 넣은 것"}])
        await db.commit()

    assert await _run(session_factory, _kst(6)) == 0
    assert await _items(session_factory, goal_id) == ["직접 넣은 것"]


async def test_weekday_is_respected(client: AsyncClient, session_factory):
    """화·목만 하는 계획이 월요일에 들어오면 안 된다."""
    await _goal_with_routine(client, session_factory, email="r4@b.com", weekdays="13")

    assert await _run(session_factory, _kst(6)) == 0


async def test_completed_goal_is_skipped(client: AsyncClient, session_factory):
    goal_id = await _goal_with_routine(client, session_factory, email="r5@b.com")
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        goal.completed_at = datetime.now(UTC)
        await db.commit()

    assert await _run(session_factory, _kst(6)) == 0


async def test_running_twice_makes_one_set(client: AsyncClient, session_factory):
    """스케줄러는 10분마다 돈다. 같은 시각을 두 번 지나도 한 벌이어야 한다."""
    goal_id = await _goal_with_routine(client, session_factory, email="r6@b.com")

    await _run(session_factory, _kst(6))
    await _run(session_factory, _kst(6))

    assert await _items(session_factory, goal_id) == ["1강 듣기"]


async def test_made_todos_are_marked_for_confirmation(client: AsyncClient, session_factory):
    """AI 가 그날 처음 대화할 때 '이대로 할까?' 를 한 번 묻는 근거."""
    goal_id = await _goal_with_routine(client, session_factory, email="r7@b.com")
    await _run(session_factory, _kst(6))

    async with session_factory() as db:
        todo = (await db.execute(select(Todo).where(Todo.goal_id == goal_id))).scalar_one()
        assert todo.needs_confirm is True
        assert [i.source for i in todo.items] == ["routine"]


async def test_confirmation_is_asked_once(client: AsyncClient, session_factory):
    """매 턴 다시 물으면 대화가 그 자리에 갇힌다."""
    token = await token_for(client, "r8@b.com")
    goal_id = await create_goal(client, token, name="선대냥이")
    async with session_factory() as db:
        db.add(Routine(goal_id=goal_id, content="1강 듣기", order=0))
        await db.commit()
    await _run(session_factory, _kst(6))

    from app.api.routes.goals import _goal_state

    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        first = await _goal_state(db, goal, ON)
        second = await _goal_state(db, goal, ON)

    assert first.todos_need_confirm is True
    assert second.todos_need_confirm is False
