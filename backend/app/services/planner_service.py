"""텐미닛 플래너 조회·쓰기 로직.

- 읽기: 하루치 플래너를 planned/actual 로 나눠 조립.
- 쓰기: AI 계획 생성 / 실제 기록 추가 (HTTP 노출은 이후 슬라이스).
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models.goal import Goal
from app.models.planner import Planner, PlannerBlock
from app.schemas.planner import DailyPlannerOut, PlannerBlockOut


def _block_out(b: PlannerBlock, goal_names: dict[str, str]) -> PlannerBlockOut:
    return PlannerBlockOut(
        id=b.id,
        title=b.title,
        start_minutes=b.start_minutes,
        duration_minutes=b.duration_minutes,
        kind=b.kind,
        goal_id=b.goal_id,
        # 화면이 '1-1 소주제 공부 · 선대냥이' 처럼 붙여 쓴다.
        # 지워진 목표는 goal_id 가 끊겨(SET NULL) 이름 없이 제목만 남는다.
        goal_name=goal_names.get(b.goal_id) if b.goal_id else None,
    )


async def _goal_names(db: AsyncSession, blocks: list[PlannerBlock]) -> dict[str, str]:
    """블록들이 가리키는 목표의 이름을 한 번에 읽는다(블록마다 조회하지 않도록)."""
    ids = {b.goal_id for b in blocks if b.goal_id}
    if not ids:
        return {}
    rows = (await db.execute(select(Goal.id, Goal.name).where(Goal.id.in_(ids)))).all()
    return {goal_id: name for goal_id, name in rows}


async def _get_planner(db: AsyncSession, user_id: str, on: date) -> Planner | None:
    stmt = select(Planner).where(Planner.user_id == user_id, Planner.date == on)
    return (await db.execute(stmt)).scalar_one_or_none()


async def daily_planner(db: AsyncSession, user_id: str, on: date) -> DailyPlannerOut:
    """계획(kind=None)과 실제 기록(kind 있음)을 나눠 반환. 없으면 빈 플래너."""
    planner = await _get_planner(db, user_id, on)
    if planner is None:
        return DailyPlannerOut(date=on, planned=[], actual=[])

    names = await _goal_names(db, list(planner.blocks))
    planned = [_block_out(b, names) for b in planner.blocks if b.kind is None]
    actual = [_block_out(b, names) for b in planner.blocks if b.kind is not None]
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
    goal_id: str | None = None,
) -> PlannerBlock:
    """플래너 블록 추가. kind=None 이면 계획(AI), 값이 있으면 실제 기록."""
    planner = await get_or_create_planner(db, user_id, on)
    block = PlannerBlock(
        planner_id=planner.id,
        goal_id=goal_id,
        title=title,
        start_minutes=start_minutes,
        duration_minutes=duration_minutes,
        kind=kind,
    )
    db.add(block)
    await db.flush()
    return block


# ── 사용자가 직접 고치는 실제 기록 (api.md §4) ──────────────
#
# 자동 기록(집중 타이머, kind="focus")도 고칠 수 있게 둔다. 타이머를 켜 두고
# 딴짓한 날을 바로잡을 길이 있어야 한다. 대신 계획(kind=None)은 AI 가 세우므로
# 이 경로로 건드리지 않는다.


async def _reject_overlap(
    db: AsyncSession,
    user_id: str,
    on: date,
    *,
    start_minutes: int,
    duration_minutes: int,
    exclude_id: str | None = None,
) -> None:
    """같은 시간대에 실제 기록이 이미 있으면 막는다.

    표는 한 칸에 블록 하나만 그리므로, 겹쳐 넣으면 뒤쪽이 화면에서 사라진다.
    누를 수가 없으니 지울 방법도 없어진다 — 받아 두면 안 되는 값이다.
    """
    planner = await _get_planner(db, user_id, on)
    if planner is None:
        return

    end = start_minutes + duration_minutes
    for block in planner.blocks:
        if block.kind is None or block.id == exclude_id:
            continue  # 계획은 다른 열에 그려서 겹쳐도 된다
        if (
            block.start_minutes < end
            and start_minutes < block.start_minutes + block.duration_minutes
        ):
            raise AppError(
                "BLOCK_OVERLAPS",
                f"'{block.title}' 기록과 시간이 겹칩니다.",
                status_code=422,
            )


async def _owned_block(db: AsyncSession, user_id: str, on: date, block_id: str) -> PlannerBlock:
    block = await db.get(PlannerBlock, block_id)
    if block is None:
        raise AppError("BLOCK_NOT_FOUND", "기록을 찾을 수 없습니다.", status_code=404)
    planner = await db.get(Planner, block.planner_id)
    if planner is None or planner.user_id != user_id or planner.date != on:
        raise AppError("BLOCK_NOT_FOUND", "기록을 찾을 수 없습니다.", status_code=404)
    if block.kind is None:
        raise AppError("PLAN_NOT_EDITABLE", "계획은 직접 고칠 수 없습니다.", status_code=400)
    return block


async def add_actual(
    db: AsyncSession,
    user_id: str,
    on: date,
    *,
    title: str,
    start_minutes: int,
    duration_minutes: int,
) -> PlannerBlock:
    """사용자가 손으로 넣은 실제 기록(kind="manual")."""
    if start_minutes + duration_minutes > 24 * 60:
        raise AppError("BLOCK_PAST_MIDNIGHT", "자정을 넘길 수 없습니다.", status_code=422)
    await _reject_overlap(
        db, user_id, on, start_minutes=start_minutes, duration_minutes=duration_minutes
    )
    return await add_block(
        db,
        user_id,
        on,
        title=title.strip(),
        start_minutes=start_minutes,
        duration_minutes=duration_minutes,
        kind="manual",
    )


async def update_actual(
    db: AsyncSession,
    user_id: str,
    on: date,
    block_id: str,
    *,
    title: str,
    start_minutes: int,
    duration_minutes: int,
) -> PlannerBlock:
    if start_minutes + duration_minutes > 24 * 60:
        raise AppError("BLOCK_PAST_MIDNIGHT", "자정을 넘길 수 없습니다.", status_code=422)
    block = await _owned_block(db, user_id, on, block_id)
    await _reject_overlap(
        db,
        user_id,
        on,
        start_minutes=start_minutes,
        duration_minutes=duration_minutes,
        exclude_id=block_id,
    )
    block.title = title.strip()
    block.start_minutes = start_minutes
    block.duration_minutes = duration_minutes
    await db.flush()
    return block


async def delete_actual(db: AsyncSession, user_id: str, on: date, block_id: str) -> None:
    block = await _owned_block(db, user_id, on, block_id)
    await db.delete(block)
    await db.flush()
