"""텐미닛 플래너 조회·쓰기 로직.

- 읽기: 하루치 플래너를 planned/actual 로 나눠 조립.
- 쓰기: AI 계획 생성 / 실제 기록 추가·수정.
- 집계: '집중한 시간' 은 전부 실제 기록에서 센다.

실제 기록(kind 있음)이 집중 시간의 유일한 출처다. 마이페이지·주간 그래프·
오늘 요약·목표별 집중 시간이 모두 여기서 읽는다. 예전에는 집중 세션 표에서
따로 셌는데, 그러면 사용자가 플래너에서 기록을 고쳐도 다른 화면이 안 바뀐다.
"""

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.timezones import as_utc, zone_of
from app.models.goal import Goal
from app.models.planner import Planner, PlannerBlock
from app.models.user import UserSettings
from app.schemas.planner import DailyPlannerOut, PlannerBlockOut

DAY_MINUTES = 24 * 60


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


async def record_session(
    db: AsyncSession,
    user_id: str,
    *,
    started_at: datetime,
    seconds: int,
    kind: str,
    goal_id: str | None,
) -> None:
    """집중 타이머·카메라 인증이 끝난 세션을 실제 기록으로 남긴다.

    분 단위로 끊는다. 10분이 한 칸이라 초는 화면에서 의미가 없고, 1분이 안 되는
    집중은 칸을 못 채우므로 남기지 않는다. 날짜는 사용자 로컬 기준이고,
    자정을 넘긴 세션은 다음 날로 나눠 담는다(하루 표 밖으로 삐져나가지 않게).
    """
    minutes = seconds // 60
    if minutes <= 0:
        return

    settings = await db.get(UserSettings, user_id)
    local = as_utc(started_at).astimezone(zone_of(settings.timezone if settings else None))
    title = "집중 인증" if kind == "verify" else "집중"
    if goal_id:
        goal = await db.get(Goal, goal_id)
        if goal is not None:
            title = goal.title or goal.name

    day, start = local.date(), local.hour * 60 + local.minute
    while minutes > 0:
        chunk = min(minutes, DAY_MINUTES - start)
        await add_block(
            db,
            user_id,
            day,
            title=title,
            start_minutes=start,
            duration_minutes=chunk,
            kind=kind,
            goal_id=goal_id,
        )
        minutes -= chunk
        day, start = day + timedelta(days=1), 0


# ── 집계: 집중 시간은 실제 기록에서 ──────────────────────────


def _actual_blocks():
    return (
        select()
        .select_from(PlannerBlock)
        .join(Planner, PlannerBlock.planner_id == Planner.id)
        .where(PlannerBlock.kind.is_not(None))
    )


async def actual_minutes_by_date(
    db: AsyncSession, user_id: str, frm: date, to: date
) -> dict[date, int]:
    """기간 안에서 실제 기록이 있는 날의 기록 시간 합(분)."""
    rows = await db.execute(
        _actual_blocks()
        .add_columns(Planner.date, func.sum(PlannerBlock.duration_minutes))
        .where(Planner.user_id == user_id, Planner.date >= frm, Planner.date <= to)
        .group_by(Planner.date)
    )
    return {day: int(minutes) for day, minutes in rows.all()}


async def goal_actual_minutes(db: AsyncSession, goal_id: str) -> int:
    """이 목표에 붙은 실제 기록 시간 합(분)."""
    stmt = (
        _actual_blocks()
        .add_columns(func.coalesce(func.sum(PlannerBlock.duration_minutes), 0))
        .where(PlannerBlock.goal_id == goal_id)
    )
    return int((await db.execute(stmt)).scalar_one())


async def verified_minutes(db: AsyncSession, user_id: str) -> tuple[int, int]:
    """카메라로 인증된 기록의 (개수, 시간 합(분)). 마이페이지 '인증 완료'."""
    stmt = (
        _actual_blocks()
        .add_columns(func.count(), func.coalesce(func.sum(PlannerBlock.duration_minutes), 0))
        .where(Planner.user_id == user_id, PlannerBlock.kind == "verify")
    )
    count, minutes = (await db.execute(stmt)).one()
    return int(count), int(minutes)


# ── 사용자가 직접 고치는 실제 기록 (api.md §4) ──────────────
#
# 자동 기록(집중 타이머, kind="focus")도 고칠 수 있게 둔다. 타이머를 켜 두고
# 딴짓한 날을 바로잡을 길이 있어야 한다. 대신 계획(kind=None)은 AI 가 세우므로
# 이 경로로 건드리지 않는다. 카메라 인증(kind="verify")은 시간을 못 바꾼다 —
# 늘릴 수 있으면 인증이 아니다. 제목 수정과 삭제는 된다.


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
    if start_minutes + duration_minutes > DAY_MINUTES:
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
    if start_minutes + duration_minutes > DAY_MINUTES:
        raise AppError("BLOCK_PAST_MIDNIGHT", "자정을 넘길 수 없습니다.", status_code=422)
    block = await _owned_block(db, user_id, on, block_id)
    if block.kind == "verify" and (
        start_minutes != block.start_minutes or duration_minutes != block.duration_minutes
    ):
        raise AppError(
            "VERIFY_TIME_LOCKED", "카메라로 인증한 기록은 시간을 바꿀 수 없습니다.", status_code=400
        )
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
