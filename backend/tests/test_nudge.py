"""계획 기반 선톡 (M3 조건 2·3).

스케줄러가 10분마다 깨어나 '지금 보낼 목표' 를 찾는다.
- 계획 시작 +10분 → "시작했어?"
- 계획 종료 +30분 → 아직 미완료면 "어떻게 됐어?"

같은 블록에 두 번 보내지 않고(Notification.ref), 목표당 하루 상한을 지킨다.
"""

from datetime import UTC, date, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Goal, Message
from app.models.notification import Notification
from app.services.nudge_service import (
    END_DELAY_MINUTES,
    MAX_NUDGES_PER_GOAL_PER_DAY,
    START_DELAY_MINUTES,
    NudgeContext,
    run_plan_nudges,
)
from app.services.planner_service import add_block
from app.services.record_service import create_daily_todo
from tests.helpers import create_goal, token_for

ON = date(2026, 9, 26)
#: 계획: 09:00 시작, 60분 (KST)
PLAN_START = 9 * 60
PLAN_MINUTES = 60


def _kst(hour: int, minute: int) -> datetime:
    """KST 벽시계 시각을 UTC 로 바꾼다. 서버는 UTC 로 판단한다."""
    return datetime(ON.year, ON.month, ON.day, hour, minute, tzinfo=UTC) - timedelta(hours=9)


async def _setup(client: AsyncClient, session_factory, *, with_todo: bool, email: str) -> str:
    token = await token_for(client, email)
    goal_id = await create_goal(client, token, name="선대냥이")
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        await add_block(
            db,
            goal.user_id,
            ON,
            title="1-1 수업",
            start_minutes=PLAN_START,
            duration_minutes=PLAN_MINUTES,
            goal_id=goal_id,
        )
        if with_todo:
            await create_daily_todo(db, goal, ON, [{"content": "1강 듣기"}])
        await db.commit()
    return goal_id


async def _messages(session_factory) -> list[str]:
    async with session_factory() as db:
        rows = await db.execute(select(Message).where(Message.role == "assistant"))
        return [m.content for m in rows.scalars().all()]


async def _run(session_factory, at: datetime) -> int:
    async with session_factory() as db:
        sent = await run_plan_nudges(db, at)
        await db.commit()
        return sent


# ── 조건 2: 시작 +10분 ──


async def test_nudge_after_plan_started(client: AsyncClient, session_factory: async_sessionmaker):
    await _setup(client, session_factory, with_todo=True, email="n1@b.com")

    # 09:10 = 시작(09:00) + 10분
    sent = await _run(session_factory, _kst(9, START_DELAY_MINUTES))

    assert sent == 1
    assert "시작할 시간" in (await _messages(session_factory))[0]


async def test_no_nudge_at_the_exact_start(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """시작 시각에 딱 맞춰 보내면 이미 책 펴고 있는 사람에게 간다."""
    await _setup(client, session_factory, with_todo=True, email="n2@b.com")

    assert await _run(session_factory, _kst(9, 0)) == 0


# ── 조건 3: 종료 +30분 ──


async def test_nudge_after_plan_ended_when_incomplete(
    client: AsyncClient, session_factory: async_sessionmaker
):
    await _setup(client, session_factory, with_todo=True, email="n3@b.com")

    # 10:30 = 종료(10:00) + 30분
    end = PLAN_START + PLAN_MINUTES + END_DELAY_MINUTES
    sent = await _run(session_factory, _kst(end // 60, end % 60))

    assert sent == 1
    assert "어떻게 됐어" in (await _messages(session_factory))[0]


async def test_no_nudge_after_end_when_nothing_left(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """할 일이 없으면 끝나고 물을 이유가 없다."""
    await _setup(client, session_factory, with_todo=False, email="n4@b.com")

    end = PLAN_START + PLAN_MINUTES + END_DELAY_MINUTES
    assert await _run(session_factory, _kst(end // 60, end % 60)) == 0


# ── 중복 방지·상한 ──


async def test_same_block_is_nudged_once(client: AsyncClient, session_factory: async_sessionmaker):
    """10분마다 도니까 표식이 없으면 같은 블록에 계속 보낸다."""
    await _setup(client, session_factory, with_todo=True, email="n5@b.com")
    at = _kst(9, START_DELAY_MINUTES)

    assert await _run(session_factory, at) == 1
    assert await _run(session_factory, at) == 0
    assert len(await _messages(session_factory)) == 1


async def test_daily_cap_per_goal(client: AsyncClient, session_factory: async_sessionmaker):
    """계획이 여러 개여도 목표당 하루 상한을 넘기지 않는다."""
    token = await token_for(client, "n6@b.com")
    goal_id = await create_goal(client, token, name="선대냥이")
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        # 09:00·11:00·13:00 세 개
        for hour in (9, 11, 13):
            await add_block(
                db,
                goal.user_id,
                ON,
                title=f"{hour}시 수업",
                start_minutes=hour * 60,
                duration_minutes=30,
                goal_id=goal_id,
            )
        await create_daily_todo(db, goal, ON, [{"content": "1강 듣기"}])
        await db.commit()

    for hour in (9, 11, 13):
        await _run(session_factory, _kst(hour, START_DELAY_MINUTES))

    assert len(await _messages(session_factory)) == MAX_NUDGES_PER_GOAL_PER_DAY


async def test_muted_goal_is_skipped(client: AsyncClient, session_factory: async_sessionmaker):
    goal_id = await _setup(client, session_factory, with_todo=True, email="n7@b.com")
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        goal.is_notification_muted = True
        await db.commit()

    assert await _run(session_factory, _kst(9, START_DELAY_MINUTES)) == 0


async def test_block_without_goal_is_skipped(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """어느 방에 보낼지 모르는 계획은 건너뛴다(goal_id 가 없는 과거 데이터)."""
    token = await token_for(client, "n8@b.com")
    goal_id = await create_goal(client, token)
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        await add_block(
            db,
            goal.user_id,
            ON,
            title="목표 없는 계획",
            start_minutes=PLAN_START,
            duration_minutes=30,
        )
        await db.commit()

    assert await _run(session_factory, _kst(9, START_DELAY_MINUTES)) == 0


async def test_nudge_records_goal_and_ref(client: AsyncClient, session_factory: async_sessionmaker):
    """상한과 중복 방지가 이 두 값으로 돈다."""
    goal_id = await _setup(client, session_factory, with_todo=True, email="n9@b.com")
    await _run(session_factory, _kst(9, START_DELAY_MINUTES))

    async with session_factory() as db:
        rows = await db.execute(select(Notification).where(Notification.type == "nudge"))
        notif = rows.scalars().one()
    assert notif.goal_id == goal_id
    assert notif.ref.startswith("plan_start:")


async def test_custom_writer_is_used(client: AsyncClient, session_factory: async_sessionmaker):
    """AI 문구 생성기를 끼울 수 있어야 한다(기본은 템플릿)."""
    await _setup(client, session_factory, with_todo=True, email="n10@b.com")

    async def writer(ctx: NudgeContext) -> str:
        return f"[{ctx.kind}] {ctx.goal.name} 화이팅"

    async with session_factory() as db:
        await run_plan_nudges(db, _kst(9, START_DELAY_MINUTES), writer=writer)
        await db.commit()

    assert (await _messages(session_factory))[0] == "[plan_start] 선대냥이 화이팅"


async def test_writer_failure_falls_back_to_template(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """문구 생성이 실패해도 선톡은 나가야 한다."""
    await _setup(client, session_factory, with_todo=True, email="n11@b.com")

    async def broken(_ctx: NudgeContext) -> str:
        raise RuntimeError("모델 호출 실패")

    async with session_factory() as db:
        sent = await run_plan_nudges(db, _kst(9, START_DELAY_MINUTES), writer=broken)
        await db.commit()

    assert sent == 1
    assert "시작할 시간" in (await _messages(session_factory))[0]


async def test_writer_gets_the_plan_and_what_is_left(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """목표만 넘기면 '선대냥이 시작할 시간이야' 밖에 못 쓴다.

    계획 이름과 남은 할 일까지 줘야 문구가 구체적으로 나온다.
    """
    await _setup(client, session_factory, with_todo=True, email="n12@b.com")
    seen: list[NudgeContext] = []

    async def writer(ctx: NudgeContext) -> str:
        seen.append(ctx)
        return "확인"

    async with session_factory() as db:
        await run_plan_nudges(db, _kst(9, START_DELAY_MINUTES), writer=writer)
        await db.commit()

    assert seen[0].block_title == "1-1 수업"
    assert seen[0].remaining == ["1강 듣기"]


async def test_default_writer_names_the_plan(client: AsyncClient, session_factory):
    """계획 이름이 있으면 목표 이름보다 그걸 쓴다(뭘 하기로 했는지가 중요하다)."""
    await _setup(client, session_factory, with_todo=True, email="n13@b.com")

    await _run(session_factory, _kst(9, START_DELAY_MINUTES))

    assert "1-1 수업" in (await _messages(session_factory))[0]


async def test_nudge_is_stamped_with_the_judged_time(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """알림 시각은 '판단에 쓴 시각' 이어야 한다.

    진짜 현재 시각으로 찍으면 하루 상한을 세는 쪽이 보는 날짜와 어긋난다.
    자정을 넘긴 틱에서는 그 날 보낸 선톡이 0건으로 세어져 상한이 풀린다
    (실제로 날짜가 바뀐 날 CI 에서 터졌다).
    """
    await _setup(client, session_factory, with_todo=True, email="n14@b.com")
    at = _kst(9, START_DELAY_MINUTES)

    await _run(session_factory, at)

    async with session_factory() as db:
        rows = await db.execute(select(Notification).where(Notification.type == "nudge"))
        notif = rows.scalars().one()
    assert notif.created_at == at
