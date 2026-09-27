"""기록(투두) 조회·쓰기 로직.

- 읽기: 날짜별 투두 / 캘린더 완료 표시 조립
- 쓰기: AI 생성물 경로에서 쓸 create/check 함수(진도 연동 포함)
  (HTTP 엔드포인트는 AI 툴 슬라이스에서 붙인다. 지금은 서비스 함수로 제공)
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models.goal import Goal
from app.models.todo import Todo, TodoItem
from app.schemas.record import TODO_ITEM_MAX, DailyTodoOut, TodoItemOut, TodoMark
from app.services.goal_service import apply_progress_delta
from app.services.progress_service import sync_milestones


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
                is_goal_completed=goal is not None and goal.completed_at is not None,
                items=[
                    TodoItemOut(
                        id=i.id,
                        content=i.content,
                        is_done=i.is_done,
                        tag=i.tag,
                        # 과거 데이터(NULL)는 AI 가 만든 것으로 본다
                        source=i.source or "ai",
                    )
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


async def add_todo_items(
    db: AsyncSession, goal: Goal, on: date, items: list[dict]
) -> tuple[Todo, list[TodoItem], int]:
    """그날 투두 묶음에 항목을 추가(없으면 생성). 하루 한 목표 = 한 묶음 유지.

    같은 날 같은 내용은 건너뛴다. AI 가 이미 만든 걸 못 보고 다시 부르는 일이
    잦아서(읽기 도구가 없던 시절의 잔재) 같은 할 일이 그대로 쌓였다.

    반환: (묶음, 새로 만든 항목들, 건너뛴 수)
    """
    todo = (
        await db.execute(select(Todo).where(Todo.goal_id == goal.id, Todo.date == on))
    ).scalar_one_or_none()
    if todo is None:
        todo = Todo(goal_id=goal.id, date=on)
        db.add(todo)

    # 이미 있는 것과 이번 요청 안에서의 중복을 같은 집합으로 본다.
    # (한 호출에 같은 내용을 두 번 넣어 보내는 경우도 있다)
    seen = {i.content.strip() for i in todo.items}
    created: list[TodoItem] = []
    skipped = 0
    for it in items:
        content = it["content"].strip()
        if content in seen:
            skipped += 1
            continue
        seen.add(content)
        item = TodoItem(
            content=content,
            tag=it.get("tag"),
            progress_delta=int(it.get("progress_delta", 0)),
            source="ai",
        )
        todo.items.append(item)
        created.append(item)

    await db.flush()
    return todo, created, skipped


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
    # 진도가 움직였으면 로드맵 단계도 따라간다(체크 해제면 되돌아간다)
    if item.progress_delta:
        await sync_milestones(db, goal)


# ── 사용자가 직접 고치는 경로 (api.md §4) ──────────────────


async def owned_todo(db: AsyncSession, user_id: str, todo_id: str) -> Todo:
    """내 투두 묶음 하나. 남의 것이면 404."""
    todo = await db.get(Todo, todo_id)
    if todo is None:
        raise AppError("TODO_NOT_FOUND", "투두를 찾을 수 없습니다.", status_code=404)
    goal = await db.get(Goal, todo.goal_id)
    if goal is None or goal.user_id != user_id:
        raise AppError("TODO_NOT_FOUND", "투두를 찾을 수 없습니다.", status_code=404)
    return todo


def _item_of(todo: Todo, item_id: str) -> TodoItem:
    for item in todo.items:
        if item.id == item_id:
            return item
    raise AppError("TODO_ITEM_NOT_FOUND", "할 일을 찾을 수 없습니다.", status_code=404)


async def add_user_item(db: AsyncSession, todo: Todo, content: str, tag: str | None) -> TodoItem:
    """사용자가 직접 넣은 항목.

    progress_delta 는 0 이다 — 진도로 셀지는 AI 가 판단할 일이고,
    사용자가 넣은 할 일이 진도를 멋대로 올리면 숫자가 어긋난다.
    """
    if len(todo.items) >= TODO_ITEM_MAX:
        raise AppError(
            "TODO_ITEM_LIMIT",
            f"할 일은 하루 {TODO_ITEM_MAX}개까지 추가할 수 있습니다.",
            status_code=422,
        )
    item = TodoItem(content=content.strip(), tag=tag, progress_delta=0, source="user")
    todo.items.append(item)
    await db.flush()
    return item


async def update_item(db: AsyncSession, todo: Todo, item_id: str, content: str, tag: str | None):
    item = _item_of(todo, item_id)
    item.content = content.strip()
    item.tag = tag
    await db.flush()
    return item


async def delete_item(db: AsyncSession, todo: Todo, item_id: str) -> None:
    """항목 삭제. 완료된 항목이면 올려 둔 진도를 먼저 되돌린다."""
    item = _item_of(todo, item_id)
    if item.is_done and item.progress_delta:
        goal = await db.get(Goal, todo.goal_id)
        apply_progress_delta(goal, -item.progress_delta)
        await sync_milestones(db, goal)
    todo.items.remove(item)
    await db.flush()
