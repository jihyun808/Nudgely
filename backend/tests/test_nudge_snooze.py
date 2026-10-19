"""선톡 스누즈: '오늘은 그만' 도구 + send_nudge 차단."""

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Goal
from app.services.notification_service import send_nudge
from tests.helpers import call_tool, create_goal, token_for


async def test_snooze_sets_until(client, session_factory: async_sessionmaker):
    token = await token_for(client)
    gid = await create_goal(client, token)

    out = await call_tool(session_factory, gid, "snooze_nudges", {})
    assert "멈춘" in out
    async with session_factory() as s:
        g = await s.get(Goal, gid)
        assert g.nudge_snoozed_until is not None
        assert g.nudge_snoozed_until > datetime.now(UTC)


async def test_send_nudge_blocked_while_snoozed(client, session_factory: async_sessionmaker):
    token = await token_for(client)
    gid = await create_goal(client, token)
    await call_tool(session_factory, gid, "snooze_nudges", {})

    async with session_factory() as s:
        g = await s.get(Goal, gid)
        msg = await send_nudge(s, g, "독촉!", now_utc=datetime.now(UTC))
        assert msg is None  # 스누즈 중이라 선톡 안 나감


async def test_send_nudge_ok_after_snooze_expires(client, session_factory: async_sessionmaker):
    token = await token_for(client)
    gid = await create_goal(client, token)
    async with session_factory() as s:
        g = await s.get(Goal, gid)
        g.nudge_snoozed_until = datetime.now(UTC) - timedelta(hours=1)  # 이미 지남
        await s.commit()

    async with session_factory() as s:
        g = await s.get(Goal, gid)
        msg = await send_nudge(s, g, "독촉!", now_utc=datetime.now(UTC))
        assert msg is not None  # 하루 지나면 자동 해제


async def test_resume_clears_snooze(client, session_factory: async_sessionmaker):
    token = await token_for(client)
    gid = await create_goal(client, token)
    await call_tool(session_factory, gid, "snooze_nudges", {})

    out = await call_tool(session_factory, gid, "snooze_nudges", {"resume": True})
    assert "다시" in out
    async with session_factory() as s:
        g = await s.get(Goal, gid)
        assert g.nudge_snoozed_until is None
        msg = await send_nudge(s, g, "독촉!", now_utc=datetime.now(UTC))
        assert msg is not None
