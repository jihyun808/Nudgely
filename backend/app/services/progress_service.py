"""목표 진도(모아보기) 조립 · 마일스톤 쓰기.

- build_goal_progress: 마일스톤 + 집계를 모아 GoalProgressOut 로.
- set_milestones: AI가 마일스톤을 통째로 교체(쓰기 경로).

focusedSeconds 는 집중 세션에 goal_id 가 붙어야 채워진다.
집중 화면에 목표 선택 UI 가 없어서(api.md §8-7 미정) 지금은 대부분 None 이다.
"""

from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.focus import FocusSession
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


async def _focused_seconds(db: AsyncSession, goal_id: str) -> int:
    """이 목표에 붙은 집중 세션 시간 합(초). goal_id 가 붙은 세션만."""
    stmt = select(func.coalesce(func.sum(FocusSession.seconds), 0)).where(
        FocusSession.goal_id == goal_id
    )
    return int((await db.execute(stmt)).scalar_one())


async def _best_month(db: AsyncSession, goal_id: str) -> str | None:
    """완료한 할 일이 가장 많았던 달 ('YYYY-MM'). 완료가 없으면 None.

    기준을 '집중 시간' 이 아니라 '완료한 할 일' 로 잡았다.
    집중 세션에는 목표 id 가 붙지 않아(api.md §8-7 미정) 항상 비어 있기 때문이다.
    날짜는 Todo.date(그 할 일이 속한 날) — 이미 사용자 기준 날짜라 타임존 변환이 필요 없다.

    월 단위 묶기는 SQL 이 아니라 파이썬에서 한다. strftime 은 SQLite 전용이라
    Postgres 로 옮길 때 깨진다. 날짜별로 집계하면 행 수가 적어 부담도 없다.
    """
    rows = await db.execute(
        select(Todo.date, func.count())
        .select_from(TodoItem)
        .join(Todo, TodoItem.todo_id == Todo.id)
        .where(Todo.goal_id == goal_id, TodoItem.is_done.is_(True))
        .group_by(Todo.date)
    )

    per_month: dict[str, int] = defaultdict(int)
    for day, count in rows.all():
        per_month[day.strftime("%Y-%m")] += count

    if not per_month:
        return None
    # 개수가 같으면 최근 달을 고른다 (회고에서 더 와닿는 쪽)
    return max(per_month.items(), key=lambda item: (item[1], item[0]))[0]


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
    focused = await _focused_seconds(db, goal.id)
    best_month = await _best_month(db, goal.id)

    return GoalProgressOut(
        goal_id=goal.id,
        goal_title=_title_of(goal),
        started_at=goal.started_at,
        completed_at=goal.completed_at,
        progress=goal.progress,
        milestones=[ProgressMilestoneOut(id=m.id, title=m.title, status=m.status) for m in ms_rows],
        # 집계: 없으면(0) 생략 → 프론트가 해당 칸을 그리지 않는다.
        completed_todo_count=completed or None,
        focused_seconds=focused or None,
        best_month=best_month,
    )


# ── 쓰기(AI 경로에서 사용) ───────────────────────────


async def set_milestones(db: AsyncSession, goal: Goal, milestones: list[dict]) -> None:
    """마일스톤을 통째로 교체. milestones: [{title, status?, target?}] (순서대로).

    교체 뒤 진도와 한 번 맞춘다. 진도가 이미 있는데 AI 가 준 status 를 그대로 두면
    '24개 중 12개' 인 목표에 전부 upcoming 인 로드맵이 붙는다.
    """
    await db.execute(Milestone.__table__.delete().where(Milestone.goal_id == goal.id))
    for i, m in enumerate(milestones):
        db.add(
            Milestone(
                goal_id=goal.id,
                title=m["title"],
                status=m.get("status", "upcoming"),
                target_progress=m.get("target"),
                order=i,
            )
        )
    await db.flush()
    await sync_milestones(db, goal)


def _thresholds(rows: list[Milestone], total: int) -> list[int]:
    """각 단계가 끝나는 진도 지점.

    AI 가 target 을 다 줬으면 그대로 쓰고, 하나라도 비면 균등 분할로 본다
    (24개를 4단계로 → 6/12/18/24). 섞어 쓰면 단계 순서가 뒤집힐 수 있어
    '전부 있거나 전부 없거나' 로만 다룬다.
    """
    if all(m.target_progress is not None for m in rows):
        return [int(m.target_progress) for m in rows]
    count = len(rows)
    return [round(total * (i + 1) / count) for i in range(count)]


async def sync_milestones(db: AsyncSession, goal: Goal) -> None:
    """진도에 맞춰 마일스톤 status 를 다시 계산한다.

    진도가 진실이다 — 투두를 체크해 진도가 오르면 단계도 따라 올라간다.
    진도가 아직 없으면(total 미설정) 아무것도 하지 않는다. 그때는 AI 가
    set_milestones 로 직접 지정한 status 가 그대로 남는다.
    """
    progress = goal.progress or {}
    total = int(progress.get("total") or 0)
    if total <= 0:
        return

    rows = (
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
    if not rows:
        return

    current = int(progress.get("current") or 0)
    thresholds = _thresholds(list(rows), total)

    has_current = False
    for milestone, threshold in zip(rows, thresholds, strict=True):
        if current >= threshold:
            milestone.status = "done"
        elif not has_current:
            # 끝나지 않은 첫 단계가 '진행 중'. 나머지는 예정이다
            milestone.status = "current"
            has_current = True
        else:
            milestone.status = "upcoming"

    await db.flush()
