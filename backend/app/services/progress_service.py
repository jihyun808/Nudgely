"""목표 진도(모아보기) 조립 · 마일스톤 쓰기.

- build_goal_progress: 마일스톤 + 집계를 모아 GoalProgressOut 로.
- set_milestones: AI가 마일스톤을 통째로 교체(쓰기 경로).

focusedSeconds/bestMonth 는 집중 세션(4단계)이 있어야 채워지므로 지금은 None.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.models.milestone import Milestone
from app.models.todo import Todo, TodoItem
from app.schemas.archive import GoalProgressOut, ProgressMilestoneOut


def _title_of(goal: Goal) -> str:
    return goal.title or goal.name


async def _completed_todo_count(db: AsyncSession, goal_id: str) -> int:
    stmt = (
        select(func.count())
        .select_from(TodoItem)
        .join(Todo, TodoItem.todo_id == Todo.id)
        .where(Todo.goal_id == goal_id, TodoItem.is_done.is_(True))
    )
    return int((await db.execute(stmt)).scalar_one())


async def build_goal_progress(db: AsyncSession, goal: Goal) -> GoalProgressOut:
    ms_rows = (
        (
            await db.execute(
                select(Milestone)
                .where(Milestone.goal_id == goal.id)
                .order_by(Milestone.order, Milestone.created_at)
            )
        )
        .scalars()
        .all()
    )

    completed = await _completed_todo_count(db, goal.id)

    return GoalProgressOut(
        goal_id=goal.id,
        goal_title=_title_of(goal),
        started_at=goal.started_at,
        completed_at=goal.completed_at,
        milestones=[ProgressMilestoneOut(id=m.id, title=m.title, status=m.status) for m in ms_rows],
        # 집계: 완료 투두 수만 지금 계산. 나머지는 4단계(집중)에서.
        completed_todo_count=completed or None,
    )


# ── 쓰기(AI 경로에서 사용) ───────────────────────────


async def set_milestones(db: AsyncSession, goal: Goal, milestones: list[dict]) -> None:
    """마일스톤을 통째로 교체. milestones: [{title, status}] (순서대로)."""
    await db.execute(Milestone.__table__.delete().where(Milestone.goal_id == goal.id))
    for i, m in enumerate(milestones):
        db.add(
            Milestone(
                goal_id=goal.id,
                title=m["title"],
                status=m.get("status", "upcoming"),
                order=i,
            )
        )
    await db.flush()
