"""기록(투두) 조회·쓰기 로직.

- 읽기: 날짜별 투두 / 캘린더 완료 표시 조립
- 쓰기: AI 생성물 경로에서 쓸 create/check 함수(진도 연동 포함)
  (HTTP 엔드포인트는 AI 툴 슬라이스에서 붙인다. 지금은 서비스 함수로 제공)
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.models.todo import Todo, TodoItem
from app.schemas.record import DailyTodoOut, TodoItemOut, TodoMark
from app.services.goal_service import apply_progress_delta


def _title_of(goal: Goal) -> str:
    return goal.title or goal.name


async def daily_todos(db: AsyncSession, user_id: str, on: date) -> list[DailyTodoOut]:
    """특정 날짜의 투두를 목표별 묶음으로. 그날 할 일 없는 목표는 빠진다."""
    stmt = (
        select(Todo)
        .join(Goal, Todo.goal_id == Goal.id)
        .where(Goal.user_id == user_id, Todo.date == on)
        .order_by(Todo.created_at)
    )
    todos = (await db.execute(stmt)).scalars().all()

    result: list[DailyTodoOut] = []
    for t in todos:
        goal = await db.get(Goal, t.goal_id)
        result.append(
            DailyTodoOut(
                id=t.id,
                goal_id=t.goal_id,
                goal_title=_title_of(goal),
                date=t.date,
                items=[
                    TodoItemOut(id=i.id, content=i.content, is_done=i.is_done, tag=i.tag)
                    for i in t.items
                ],
            )
        )
    return result


async def todo_marks(db: AsyncSession, user_id: str, month: str) -> list[TodoMark]:
    """한 달치 완료 표시. 완료 항목 하나마다 그 목표 id 를 하나씩 넣는다.

    month: 'YYYY-MM'
    """
    stmt = select(Todo).join(Goal, Todo.goal_id == Goal.id).where(Goal.user_id == user_id)
    todos = (await db.execute(stmt)).scalars().all()

    by_date: dict[date, list[str]] = {}
    for t in todos:
        if t.date.strftime("%Y-%m") != month:
            continue
        done_ids = [t.goal_id for i in t.items if i.is_done]
        if not done_ids:
            continue
        by_date.setdefault(t.date, []).extend(done_ids)

    return [TodoMark(date=d, done_goal_ids=ids) for d, ids in sorted(by_date.items())]


# ── 쓰기(AI 생성물 경로에서 사용) ───────────────────────────


async def create_daily_todo(db: AsyncSession, goal: Goal, on: date, items: list[dict]) -> Todo:
    """하루치 투두를 생성. items: [{content, tag?, progress_delta?}]."""
    todo = Todo(goal_id=goal.id, date=on)
    for it in items:
        todo.items.append(
            TodoItem(
                content=it["content"],
                tag=it.get("tag"),
                progress_delta=int(it.get("progress_delta", 0)),
            )
        )
    db.add(todo)
    await db.flush()
    return todo


async def add_todo_items(db: AsyncSession, goal: Goal, on: date, items: list[dict]) -> Todo:
    """그날 투두 묶음에 항목을 추가(없으면 생성). 하루 한 목표 = 한 묶음 유지."""
    existing = (
        await db.execute(select(Todo).where(Todo.goal_id == goal.id, Todo.date == on))
    ).scalar_one_or_none()
    if existing is None:
        return await create_daily_todo(db, goal, on, items)

    for it in items:
        existing.items.append(
            TodoItem(
                content=it["content"],
                tag=it.get("tag"),
                progress_delta=int(it.get("progress_delta", 0)),
            )
        )
    await db.flush()
    return existing


async def set_item_done(db: AsyncSession, item: TodoItem, done: bool) -> None:
    """항목 체크/해제 + 목표 진도 반영. 상태가 실제로 바뀔 때만 delta 적용."""
    from datetime import UTC, datetime

    if item.is_done == done:
        return
    item.is_done = done
    item.done_at = datetime.now(UTC) if done else None

    todo = await db.get(Todo, item.todo_id)
    goal = await db.get(Goal, todo.goal_id)
    apply_progress_delta(goal, item.progress_delta if done else -item.progress_delta)
