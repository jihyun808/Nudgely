"""반복 계획 → 아침에 오늘 투두 만들기.

사용자가 채팅방에 들어와야만 투두가 생기면, 앱을 안 연 날은 아무 일도 안 일어난다.
독촉이 가장 필요한 사람에게 밤 11시 점검도 못 간다는 뜻이다.

만들어 둔 묶음은 needs_confirm 으로 표시하고, 그날 처음 대화할 때 AI 가 한 번
확인받는다(prompts._stage_line).
"""

import logging
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezones import local_now, zone_of
from app.models.goal import Goal
from app.models.todo import Todo, TodoItem
from app.models.user import User, UserSettings
from app.services.goal_service import routine_applies_today, routines_of

logger = logging.getLogger(__name__)


async def _has_todo(db: AsyncSession, goal_id: str, on: date) -> bool:
    row = await db.execute(select(Todo.id).where(Todo.goal_id == goal_id, Todo.date == on).limit(1))
    return row.first() is not None


async def _active_goals(db: AsyncSession, user_id: str) -> list[Goal]:
    rows = await db.execute(
        select(Goal).where(
            Goal.user_id == user_id,
            Goal.is_hidden.is_(False),
            Goal.completed_at.is_(None),
        )
    )
    return list(rows.scalars().all())


async def run_routine_todos(
    db: AsyncSession, now_utc: datetime | None = None, target_hour: int = 6
) -> int:
    """오늘 할 일을 반복 계획대로 만들어 둔다. 만든 묶음 수를 반환.

    사용자 로컬 시각 기준이며, 지금 로컬로 target_hour 인 사람만 처리한다.
    이미 그날 투두가 있으면 건드리지 않는다.
    """
    now_utc = now_utc or datetime.now(UTC)
    users = (await db.execute(select(User).where(User.deleted_at.is_(None)))).scalars().all()
    made = 0

    for user in users:
        settings = await db.get(UserSettings, user.id)
        local = local_now(zone_of(settings.timezone if settings else None), now_utc)
        if local.hour != target_hour:
            continue
        on = local.date()

        for goal in await _active_goals(db, user.id):
            if await _has_todo(db, goal.id, on):
                continue
            items = [r for r in await routines_of(db, goal.id) if routine_applies_today(r, on)]
            if not items:
                continue

            todo = Todo(goal_id=goal.id, date=on, needs_confirm=True)
            for r in items:
                todo.items.append(
                    TodoItem(
                        content=r.content,
                        tag=r.tag,
                        progress_delta=r.progress_delta,
                        source="routine",
                    )
                )
            db.add(todo)
            made += 1

    await db.flush()
    return made


__all__ = ["run_routine_todos"]
