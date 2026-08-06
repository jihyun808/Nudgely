"""집중 세션 저장 · 집계 로직 (api.md §6).

- save_session: 중복(같은 user+started_at) 방지 후 저장.
- summary: 오늘 집중 시간 + 목표 시간(플래너 계획 합) + 연속 기록(streak).
- weekly: 월~일 요일별 집중 시간(시간) + 지난주 대비 증감.
- daily: 기간별 일자 집중 시간(마이페이지 히트맵).

연속 기록(streak)은 '투두가 체크된 날' 기준이며 과거 전체 이력이 필요하다.
"""

from datetime import UTC, date, datetime, time, timedelta

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


def _day_bounds(d: date) -> tuple[datetime, datetime]:
    start = datetime.combine(d, time.min, tzinfo=UTC)
    return start, start + timedelta(days=1)


async def _seconds_on(db: AsyncSession, user_id: str, d: date) -> int:
    start, end = _day_bounds(d)
    stmt = select(func.coalesce(func.sum(FocusSession.seconds), 0)).where(
        FocusSession.user_id == user_id,
        FocusSession.started_at >= start,
        FocusSession.started_at < end,
    )
    return int((await db.execute(stmt)).scalar_one())


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
    focused = await _seconds_on(db, user_id, on)
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
    hours: list[float] = []
    for i in range(7):
        secs = await _seconds_on(db, user_id, week_start + timedelta(days=i))
        hours.append(_round1(secs / 3600))

    last_total = 0
    for i in range(7):
        last_total += await _seconds_on(db, user_id, week_start - timedelta(days=7 - i))

    diff = _round1(sum(hours) - last_total / 3600)
    return WeeklyFocusOut(hours=hours, diff_from_last_week=diff)


async def daily(db: AsyncSession, user_id: str, frm: date, to: date) -> DailyFocusOut:
    """기간 내 '집중 기록이 있는' 날의 일자별 합(마이페이지 히트맵)."""
    start, _ = _day_bounds(frm)
    _, end = _day_bounds(to)
    rows = (
        await db.execute(
            select(FocusSession.started_at, FocusSession.seconds).where(
                FocusSession.user_id == user_id,
                FocusSession.started_at >= start,
                FocusSession.started_at < end,
            )
        )
    ).all()

    by_day: dict[date, int] = {}
    for started_at, seconds in rows:
        by_day[started_at.date()] = by_day.get(started_at.date(), 0) + seconds

    days = [DailyFocusItem(date=d.isoformat(), seconds=s) for d, s in sorted(by_day.items())]
    return DailyFocusOut(days=days)
