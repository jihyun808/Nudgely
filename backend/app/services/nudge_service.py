"""선톡(독촉) — AI 가 먼저 말을 건다 (M3).

스케줄러가 10분마다 불러 조건에 맞는 목표를 찾고, 그 채팅방에 assistant 메시지를
남긴다(notification_service.send_nudge). 알림은 '무슨 일이 있었는지' 만 알리고
누르면 앱이 열리는 것까지가 역할이다.

조건 세 가지:
1. 밤 11시에 오늘 미완료 투두가 있을 때          → notification_service 의 밤 점검
2. 계획한 시간이 시작되고 10분 뒤                → "시작했어?"
3. 계획한 시간이 끝나고 30분 뒤, 아직 미완료면   → "어떻게 됐어?"

2·3 은 플래너 블록 기준이라 10분 단위로 깨어나야 잡힌다. 매시간 정각만 돌면
09:20 에 시작하는 계획은 아무 때도 걸리지 않는다.

같은 블록에 두 번 보내지 않도록 Notification.ref 에 표식을 남긴다
("plan_start:plb_01H"). 스케줄러가 10분마다 도니까 이게 없으면 계속 보낸다.
"""

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezones import day_bounds, local_now, zone_of
from app.models.goal import Goal
from app.models.notification import Notification
from app.models.planner import Planner, PlannerBlock
from app.models.todo import Todo, TodoItem
from app.models.user import User, UserSettings
from app.services.notification_service import send_nudge

logger = logging.getLogger(__name__)

#: 계획 시작 뒤 이만큼 지나서 묻는다. 시작 시각에 딱 맞춰 보내면
#: 이미 책을 펴고 있는 사람에게 "시작할 시간이야" 가 간다.
START_DELAY_MINUTES = 10

#: 계획이 끝난 뒤 이만큼 지나서 확인한다.
END_DELAY_MINUTES = 30

#: 스케줄러가 깨어나는 간격(분). 이 폭 안에 들어오는 시각을 '지금' 으로 본다.
TICK_MINUTES = 10

#: 목표 하나에 하루 몇 번까지 선톡할지. 계획이 세 개면 시작·종료로 여섯 번이
#: 되는데, 하루에 일곱 번 오면 앱을 끈다.
MAX_NUDGES_PER_GOAL_PER_DAY = 2


@dataclass
class NudgeContext:
    """선톡 문구를 쓰는 데 필요한 것들.

    목표만 넘기면 "'선형대수' 시작할 시간이야" 밖에 못 쓴다. 계획 이름과 남은
    할 일까지 줘야 "1-1 수업 들어야 하는데 시작했어?" 가 나온다.
    """

    goal: Goal
    #: "plan_start" | "plan_end" | "no_todo" | "no_plan"
    kind: str
    #: 그 시간에 하기로 한 일(PlannerBlock.title). 계획 없는 선톡이면 None
    block_title: str | None = None
    #: 오늘 아직 안 끝낸 할 일들
    remaining: list[str] = field(default_factory=list)


#: 선톡 문구를 만드는 함수. 상황 → 보낼 말.
#: 기본은 템플릿이고, AI 생성기(app.ai.nudge_writer.generate_nudge)를 끼운다.
NudgeWriter = Callable[[NudgeContext], Awaitable[str]]


async def default_writer(ctx: NudgeContext) -> str:
    """AI 없이 쓰는 기본 문구. 생성기가 없거나 실패했을 때 쓴다."""
    what = ctx.block_title or ctx.goal.title or ctx.goal.name
    if ctx.kind == "plan_start":
        return f"'{what}' 시작할 시간이었는데, 잘 하고 있어?"
    if ctx.kind == "plan_end":
        return f"'{what}' 어떻게 됐어? 끝냈으면 알려줘."
    if ctx.kind == "no_todo":
        return f"'{what}' 오늘은 뭘 해볼까? 정해서 할 일에 넣어줄게."
    if ctx.kind == "no_plan":
        left = ", ".join(ctx.remaining[:2])
        return f"오늘 할 일은 {left} 야. 몇 시에 할래?"
    return f"'{what}' 오늘 할 일이 아직 남아 있어. 조금만 해볼까?"


async def _already_nudged(db: AsyncSession, ref: str) -> bool:
    found = (
        await db.execute(select(Notification.id).where(Notification.ref == ref).limit(1))
    ).scalar_one_or_none()
    return found is not None


async def _nudges_today(db: AsyncSession, goal_id: str, on: date, zone) -> int:
    start, end = day_bounds(on, zone)
    return int(
        (
            await db.execute(
                select(func.count())
                .select_from(Notification)
                .where(
                    Notification.goal_id == goal_id,
                    Notification.type == "nudge",
                    Notification.created_at >= start,
                    Notification.created_at <= end,
                )
            )
        ).scalar_one()
    )


async def _remaining_items(db: AsyncSession, goal_id: str, on: date) -> list[str]:
    """오늘 아직 안 끝낸 할 일들. 조건 판단과 문구 재료를 겸한다."""
    todo = (
        await db.execute(select(Todo).where(Todo.goal_id == goal_id, Todo.date == on))
    ).scalar_one_or_none()
    if todo is None:
        return []
    return [item.content for item in todo.items if not item.is_done]


def _is_due(target_minutes: int, now_minutes: int) -> bool:
    """지금 깨어난 틱이 그 시각을 담당하는지.

    10분마다 깨어나므로 [target, target + 10) 이 이번 틱의 몫이다.
    정확히 같은 분만 보면 틱이 한 번 밀릴 때 영영 놓친다.
    """
    return target_minutes <= now_minutes < target_minutes + TICK_MINUTES


async def _plan_targets(
    db: AsyncSession, user_id: str, on: date, now_minutes: int
) -> list[tuple[PlannerBlock, str]]:
    """지금 선톡할 (계획 블록, 사유) 목록."""
    rows = (
        (
            await db.execute(
                select(PlannerBlock)
                .join(Planner, PlannerBlock.planner_id == Planner.id)
                .where(
                    Planner.user_id == user_id,
                    Planner.date == on,
                    PlannerBlock.kind.is_(None),  # 계획만(실제 기록 말고)
                    PlannerBlock.goal_id.is_not(None),  # 어느 방에 보낼지 알아야 한다
                )
            )
        )
        .scalars()
        .all()
    )

    targets = []
    for block in rows:
        if _is_due(block.start_minutes + START_DELAY_MINUTES, now_minutes):
            targets.append((block, "plan_start"))
        end = block.start_minutes + block.duration_minutes
        if _is_due(end + END_DELAY_MINUTES, now_minutes):
            targets.append((block, "plan_end"))
    return targets


async def _has_plan(db: AsyncSession, goal_id: str, user_id: str, on: date) -> bool:
    row = await db.execute(
        select(PlannerBlock.id)
        .join(Planner, PlannerBlock.planner_id == Planner.id)
        .where(
            Planner.user_id == user_id,
            Planner.date == on,
            PlannerBlock.goal_id == goal_id,
            PlannerBlock.kind.is_(None),
        )
        .limit(1)
    )
    return row.first() is not None


async def run_morning_nudges(
    db: AsyncSession,
    now_utc: datetime | None = None,
    target_hour: int = 8,
    writer: NudgeWriter = default_writer,
) -> int:
    """하루가 시작됐는데 비어 있는 목표에 AI 가 먼저 묻는다. 보낸 수를 반환.

    반복 계획이 있으면 아침에 투두가 자동으로 생기지만(routine_service), 그게
    없는 목표는 사용자가 앱을 열어야만 아무 일이 시작된다. 먼저 물어 채운다.

    routine_service 보다 늦은 시각에 돌아야 한다. 안 그러면 곧 채워질 목표에도 묻는다.
    """
    now_utc = now_utc or datetime.now(UTC)
    users = (await db.execute(select(User).where(User.deleted_at.is_(None)))).scalars().all()
    sent = 0

    for user in users:
        settings = await db.get(UserSettings, user.id)
        zone = zone_of(settings.timezone if settings else None)
        local = local_now(zone, now_utc)
        if local.hour != target_hour:
            continue
        on = local.date()

        goals = (
            (
                await db.execute(
                    select(Goal).where(
                        Goal.user_id == user.id,
                        Goal.is_hidden.is_(False),
                        Goal.completed_at.is_(None),
                        Goal.is_notification_muted.is_(False),
                    )
                )
            )
            .scalars()
            .all()
        )

        for goal in goals:
            remaining = await _remaining_items(db, goal.id, on)
            if not remaining:
                kind = "no_todo"
            elif not await _has_plan(db, goal.id, user.id, on):
                kind = "no_plan"
            else:
                continue

            ref = f"{kind}:{goal.id}:{on.isoformat()}"
            if await _already_nudged(db, ref):
                continue
            if await _nudges_today(db, goal.id, on, zone) >= MAX_NUDGES_PER_GOAL_PER_DAY:
                continue

            ctx = NudgeContext(goal=goal, kind=kind, remaining=remaining)
            try:
                content = await writer(ctx)
            except Exception:  # noqa: BLE001
                logger.exception("아침 선톡 문구 생성 실패(goal=%s)", goal.id)
                content = await default_writer(ctx)

            if await send_nudge(db, goal, content, ref=ref, now_utc=now_utc) is not None:
                sent += 1

    await db.flush()
    return sent


async def run_plan_nudges(
    db: AsyncSession,
    now_utc: datetime | None = None,
    writer: NudgeWriter = default_writer,
) -> int:
    """계획 기반 선톡(조건 2·3). 보낸 수를 반환.

    사용자마다 타임존이 다르므로 각자의 벽시계로 판단한다.
    """
    now_utc = now_utc or datetime.now(UTC)
    users = (await db.execute(select(User).where(User.deleted_at.is_(None)))).scalars().all()
    sent = 0

    for user in users:
        settings = await db.get(UserSettings, user.id)
        zone = zone_of(settings.timezone if settings else None)
        local = local_now(zone, now_utc)
        on = local.date()
        now_minutes = local.hour * 60 + local.minute

        for block, kind in await _plan_targets(db, user.id, on, now_minutes):
            ref = f"{kind}:{block.id}"
            if await _already_nudged(db, ref):
                continue

            goal = await db.get(Goal, block.goal_id)
            if goal is None:
                continue
            remaining = await _remaining_items(db, goal.id, on)
            # 끝나고 나서 묻는 건 아직 할 일이 남았을 때만 의미가 있다
            if kind == "plan_end" and not remaining:
                continue
            if await _nudges_today(db, goal.id, on, zone) >= MAX_NUDGES_PER_GOAL_PER_DAY:
                continue

            ctx = NudgeContext(goal=goal, kind=kind, block_title=block.title, remaining=remaining)
            try:
                content = await writer(ctx)
            except Exception:  # noqa: BLE001 - 문구 생성 실패로 스케줄러를 멈추지 않는다
                logger.exception("선톡 문구 생성 실패(goal=%s)", goal.id)
                content = await default_writer(ctx)

            message = await send_nudge(db, goal, content, ref=ref, now_utc=now_utc)
            if message is not None:
                sent += 1

    await db.flush()
    return sent


def next_tick_after(now: datetime) -> datetime:
    """다음 틱 시각(테스트·로그용)."""
    return now + timedelta(minutes=TICK_MINUTES)


__all__ = [
    "MAX_NUDGES_PER_GOAL_PER_DAY",
    "run_morning_nudges",
    "NudgeContext",
    "NudgeWriter",
    "END_DELAY_MINUTES",
    "START_DELAY_MINUTES",
    "TICK_MINUTES",
    "default_writer",
    "next_tick_after",
    "run_plan_nudges",
]


# TodoItem 은 Todo.items 를 통해서만 쓰지만, 모델 등록을 위해 import 를 남긴다
_ = TodoItem
