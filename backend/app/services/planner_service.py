"""텐미닛 플래너 조회·쓰기 로직.

- 읽기: 하루치 플래너를 planned/actual 로 나눠 조립.
- 쓰기: AI 계획 생성 / 실제 기록 추가 (HTTP 노출은 이후 슬라이스).
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.planner import Planner, PlannerBlock
from app.schemas.planner import DailyPlannerOut, PlannerBlockOut


def _block_out(b: PlannerBlock) -> PlannerBlockOut:
    return PlannerBlockOut(
        id=b.id,
        title=b.title,
        start_minutes=b.start_minutes,
        duration_minutes=b.duration_minutes,
        kind=b.kind,
    )


async def _get_planner(db: AsyncSession, user_id: str, on: date) -> Planner | None:
    stmt = select(Planner).where(Planner.user_id == user_id, Planner.date == on)
    return (await db.execute(stmt)).scalar_one_or_none()


async def daily_planner(db: AsyncSession, user_id: str, on: date) -> DailyPlannerOut:
    """계획(kind=None)과 실제 기록(kind 있음)을 나눠 반환. 없으면 빈 플래너."""
    planner = await _get_planner(db, user_id, on)
    if planner is None:
        return DailyPlannerOut(date=on, planned=[], actual=[])

    planned = [_block_out(b) for b in planner.blocks if b.kind is None]
    actual = [_block_out(b) for b in planner.blocks if b.kind is not None]
    return DailyPlannerOut(date=on, planned=planned, actual=actual)


# ── 쓰기(AI / 기록 경로에서 사용) ───────────────────────────


async def get_or_create_planner(db: AsyncSession, user_id: str, on: date) -> Planner:
    planner = await _get_planner(db, user_id, on)
    if planner is None:
        planner = Planner(user_id=user_id, date=on)
        db.add(planner)
        await db.flush()
    return planner


async def add_block(
    db: AsyncSession,
    user_id: str,
    on: date,
    *,
    title: str,
    start_minutes: int,
    duration_minutes: int,
    kind: str | None = None,
) -> PlannerBlock:
    """플래너 블록 추가. kind=None 이면 계획(AI), 값이 있으면 실제 기록."""
    planner = await get_or_create_planner(db, user_id, on)
    block = PlannerBlock(
        planner_id=planner.id,
        title=title,
        start_minutes=start_minutes,
        duration_minutes=duration_minutes,
        kind=kind,
    )
    db.add(block)
    await db.flush()
    return block
