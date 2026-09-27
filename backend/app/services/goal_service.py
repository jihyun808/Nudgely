"""목표 응답 조립 · 집계 로직.

라우터는 이 함수들을 호출해 ORM 모델을 프론트 응답(GoalOut/GoalDetailOut)으로 바꾼다.
- 최근 메시지 / 안 읽은 개수 / D-day 등 계산이 여기 모여 있다.
"""

from datetime import UTC, date, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models.goal import Goal, Message, ReadState
from app.models.routine import Routine
from app.schemas.goal import GoalDetailOut, GoalOut, Progress

# 아직 대화가 없을 때 채팅 목록에 보여줄 안내 문구
EMPTY_GOAL_HINT = "새로운 목표가 만들어졌어요. 대화를 시작해보세요!"


def _clamp(current: int, total: int) -> int:
    """0 ≤ current ≤ total. total 이 없으면(0 이하) 하한만 적용."""
    if total and total > 0:
        return max(0, min(current, total))
    return max(0, current)


def apply_progress_delta(goal: Goal, delta: int) -> None:
    """투두 체크/해제 시 목표 진도를 상대값으로 조정 (ai-plan §4.3b).

    progress 가 아직 초기화되지 않았으면(total·unit 미설정) 아무것도 하지 않는다.
    → AI 가 set_progress 로 total·unit 을 먼저 세운 뒤부터 delta 가 반영된다.
    """
    if not goal.progress:
        return
    p = dict(goal.progress)
    p["current"] = _clamp(int(p.get("current", 0)) + delta, int(p.get("total", 0)))
    goal.progress = p  # JSON 변경 감지를 위해 새 dict 로 재할당


def set_progress(
    goal: Goal,
    *,
    current: int | None = None,
    total: int | None = None,
    unit: str | None = None,
) -> None:
    """AI 보정: 진도를 절대값으로 설정 (ai-plan §4.3b).

    셋 다 None 이면 아무것도 하지 않는다. 빈 호출에도 dict 를 만들어 버리면
    진도가 없던 목표의 progress 가 {0, 0, ""} 가 되고, 프론트는 이걸 진도가
    "있다"고 보아 시작일 안내 대신 0% 막대를 그린다(api.md §3.1 — 없으면 null).
    """
    if current is None and total is None and unit is None:
        return

    p = dict(goal.progress) if goal.progress else {"current": 0, "total": 0, "unit": ""}
    if total is not None:
        p["total"] = total
    if unit is not None:
        p["unit"] = unit
    if current is not None:
        p["current"] = current
    p["current"] = _clamp(int(p["current"]), int(p["total"]))
    goal.progress = p


async def get_owned_goal(db: AsyncSession, user_id: str, goal_id: str) -> Goal:
    """내 목표 하나를 가져온다. 없거나 남의 것이면 404."""
    goal = await db.get(Goal, goal_id)
    if goal is None or goal.user_id != user_id:
        raise AppError("GOAL_NOT_FOUND", "목표를 찾을 수 없습니다.", status_code=404)
    return goal


async def _latest_message(db: AsyncSession, goal_id: str) -> Message | None:
    result = await db.execute(
        select(Message)
        .where(Message.goal_id == goal_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _unread_count(db: AsyncSession, goal_id: str, user_id: str) -> int:
    """마지막으로 읽은 메시지 이후의 assistant 메시지 수.

    내 메시지는 읽음으로 보고, AI 메시지만 안 읽음으로 센다.
    """
    read = await db.get(ReadState, (user_id, goal_id))
    boundary: datetime | None = None
    if read is not None and read.last_read_message_id is not None:
        last_read = await db.get(Message, read.last_read_message_id)
        if last_read is not None:
            boundary = last_read.created_at

    stmt = select(func.count()).where(Message.goal_id == goal_id, Message.role == "assistant")
    if boundary is not None:
        stmt = stmt.where(Message.created_at > boundary)
    return int((await db.execute(stmt)).scalar_one())


def _remaining_days(goal: Goal) -> int | None:
    if goal.due_date is None:
        return None
    return (goal.due_date - datetime.now(UTC).date()).days


def _progress(goal: Goal) -> Progress | None:
    if not goal.progress:
        return None
    return Progress.model_validate(goal.progress)


async def build_goal_out(db: AsyncSession, goal: Goal, user_id: str) -> GoalOut:
    latest = await _latest_message(db, goal.id)
    return GoalOut(
        id=goal.id,
        name=goal.name,
        title=goal.title,
        image_url=goal.image_url,
        last_message=latest.content if latest else EMPTY_GOAL_HINT,
        last_message_at=latest.created_at if latest else goal.created_at,
        unread_count=await _unread_count(db, goal.id, user_id),
        started_at=goal.started_at,
        remaining_days=_remaining_days(goal),
        completed_at=goal.completed_at,
        progress=_progress(goal),
    )


async def build_goal_detail(db: AsyncSession, goal: Goal, user_id: str) -> GoalDetailOut:
    base = await build_goal_out(db, goal, user_id)
    return GoalDetailOut(
        **base.model_dump(),
        prompt=goal.prompt,
        persona=goal.persona,
        due_date=goal.due_date,
        is_notification_muted=goal.is_notification_muted,
        is_hidden=goal.is_hidden,
    )


async def set_routine(db: AsyncSession, goal: Goal, items: list[dict]) -> None:
    """'매일 할 것' 을 통째로 교체.

    items: [{content, tag?, progress_delta?, duration_minutes?, weekdays?}]
    마일스톤과 같이 교체 방식이다. 빈 배열이면 전부 지운다.
    """
    await db.execute(Routine.__table__.delete().where(Routine.goal_id == goal.id))
    for order, item in enumerate(items):
        db.add(
            Routine(
                goal_id=goal.id,
                content=item["content"],
                tag=item.get("tag"),
                progress_delta=int(item.get("progress_delta") or 0),
                duration_minutes=item.get("duration_minutes"),
                weekdays=item.get("weekdays"),
                order=order,
            )
        )
    await db.flush()


async def routines_of(db: AsyncSession, goal_id: str) -> list[Routine]:
    rows = await db.execute(
        select(Routine)
        .where(Routine.goal_id == goal_id)
        .order_by(Routine.order, Routine.created_at)
    )
    return list(rows.scalars().all())


def routine_applies_today(routine: Routine, today: date) -> bool:
    """오늘 하는 항목인지. weekdays 가 비어 있으면 매일 한다.

    월=0 … 일=6 (프론트 toMondayFirst 와 같은 기준).
    """
    if not routine.weekdays:
        return True
    return str(today.weekday()) in routine.weekdays
