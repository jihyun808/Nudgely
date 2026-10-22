"""집중 세션 저장 · 집계 로직 (api.md §6).

- save_session: 중복(같은 user+started_at) 방지 후 저장 + 플래너 실제 기록.
- summary: 오늘 집중 시간 + 목표 시간(플래너 계획 합) + 연속 기록(streak).
- weekly: 월~일 요일별 집중 시간(시간) + 지난주 대비 증감.
- daily: 기간별 일자 집중 시간(마이페이지 히트맵).

집중 시간은 전부 플래너 실제 기록에서 센다(planner_service 참고). 사용자가
플래너에서 고친 값이 그대로 이 화면들에 나와야 한다. 플래너 날짜는 이미
사용자 로컬 날짜라 여기서는 타임존을 다시 따지지 않는다.

연속 기록(streak)은 '투두가 체크된 날' 기준이며 과거 전체 이력이 필요하다.
"""

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.focus import FocusSession
from app.models.goal import Goal
from app.models.planner import Planner, PlannerBlock
from app.models.todo import Todo, TodoItem
from app.schemas.focus import (
    DailyFocusItem,
    DailyFocusOut,
    FocusSummaryOut,
    WeeklyFocusOut,
)
from app.services.planner_service import actual_minutes_by_date, record_session


async def save_session(
    db: AsyncSession,
    user_id: str,
    *,
    mode: str,
    seconds: int,
    started_at: datetime,
    goal_id: str | None = None,
) -> bool:
    """세션 저장. 같은 (user, started_at) 이 이미 있으면 무시(중복 방지). 저장했으면 True."""
    exists = (
        await db.execute(
            select(FocusSession.id).where(
                FocusSession.user_id == user_id, FocusSession.started_at == started_at
            )
        )
    ).scalar_one_or_none()
    if exists is not None:
        return False

    db.add(
        FocusSession(
            user_id=user_id,
            goal_id=goal_id,
            mode=mode,
            seconds=seconds,
            started_at=started_at,
        )
    )
    await record_session(
        db, user_id, started_at=started_at, seconds=seconds, kind="focus", goal_id=goal_id
    )
    await db.commit()
    return True


async def _target_minutes(db: AsyncSession, user_id: str, d: date) -> int:
    """오늘 플래너의 '계획'(kind=None) 블록 시간 합(분)."""
    stmt = (
        select(func.coalesce(func.sum(PlannerBlock.duration_minutes), 0))
        .select_from(PlannerBlock)
        .join(Planner, PlannerBlock.planner_id == Planner.id)
        .where(
            Planner.user_id == user_id,
            Planner.date == d,
            PlannerBlock.kind.is_(None),
        )
    )
    return int((await db.execute(stmt)).scalar_one())


async def _done_dates(db: AsyncSession, user_id: str) -> set[date]:
    """투두가 하나라도 완료된 날짜 집합(과거 전체)."""
    stmt = (
        select(Todo.date)
        .join(TodoItem, TodoItem.todo_id == Todo.id)
        .join(Goal, Todo.goal_id == Goal.id)
        .where(Goal.user_id == user_id, TodoItem.is_done.is_(True))
        .distinct()
    )
    return {row for row in (await db.execute(stmt)).scalars().all()}


def _current_streak(done: set[date], today: date) -> int:
    streak = 0
    d = today
    while d in done:
        streak += 1
        d -= timedelta(days=1)
    return streak


def _best_streak(done: set[date]) -> int:
    best = 0
    for d in done:
        # d 가 런의 시작(전날이 없음)일 때만 세어 중복 계산 방지
        if (d - timedelta(days=1)) in done:
            continue
        length = 1
        nxt = d + timedelta(days=1)
        while nxt in done:
            length += 1
            nxt += timedelta(days=1)
        best = max(best, length)
    return best


async def summary(db: AsyncSession, user_id: str, on: date) -> FocusSummaryOut:
    focused = (await actual_minutes_by_date(db, user_id, on, on)).get(on, 0) * 60
    target = await _target_minutes(db, user_id, on)

    done = await _done_dates(db, user_id)
    current = _current_streak(done, on)
    best = _best_streak(done)

    return FocusSummaryOut(
        focused_seconds=focused,
        target_minutes=target,
        streak_days=current,
        best_streak_days=best,
        is_best_streak=current > 0 and current == best,
    )


def _round1(x: float) -> float:
    return round(x * 10) / 10


async def weekly(db: AsyncSession, user_id: str, week_start: date) -> WeeklyFocusOut:
    """week_start(월요일)부터 7일. hours[i]=시간 단위, 지난주 대비 증감 포함."""
    last_start = week_start - timedelta(days=7)
    minutes = await actual_minutes_by_date(db, user_id, last_start, week_start + timedelta(days=6))
    hours = [_round1(minutes.get(week_start + timedelta(days=i), 0) / 60) for i in range(7)]
    last_total = sum(minutes.get(last_start + timedelta(days=i), 0) for i in range(7))

    diff = _round1(sum(hours) - last_total / 60)
    return WeeklyFocusOut(hours=hours, diff_from_last_week=diff)


async def daily(db: AsyncSession, user_id: str, frm: date, to: date) -> DailyFocusOut:
    """기간 내 '기록이 있는' 날의 일자별 합(마이페이지 히트맵)."""
    minutes = await actual_minutes_by_date(db, user_id, frm, to)
    days = [DailyFocusItem(date=d.isoformat(), seconds=m * 60) for d, m in sorted(minutes.items())]
    return DailyFocusOut(days=days)
