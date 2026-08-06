"""목표 응답 조립 · 집계 로직.

라우터는 이 함수들을 호출해 ORM 모델을 프론트 응답(GoalOut/GoalDetailOut)으로 바꾼다.
- 최근 메시지 / 안 읽은 개수 / D-day 등 계산이 여기 모여 있다.
"""

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models.goal import Goal, Message, ReadState
from app.schemas.goal import GoalDetailOut, GoalOut, Progress

# 아직 대화가 없을 때 채팅 목록에 보여줄 안내 문구
EMPTY_GOAL_HINT = "새로운 목표가 만들어졌어요. 대화를 시작해보세요!"


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
