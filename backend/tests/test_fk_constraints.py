"""외래 키 제약이 실제로 동작하는지 (SQLite PRAGMA foreign_keys).

SQLite 는 연결마다 FK 가 기본 꺼짐이라, 켜는 걸 빠뜨리면 ON DELETE 가
선언만 되고 아무 일도 하지 않는다. 조용히 틀리는 종류라 못박아 둔다.
"""

from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.focus import FocusSession
from app.models.goal import Message


async def _token(client: AsyncClient) -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": "fk@b.com", "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_pragma_is_on(session_factory: async_sessionmaker):
    """테스트 엔진도 앱과 같은 조건이어야 한다."""
    from sqlalchemy import text

    async with session_factory() as db:
        assert (await db.execute(text("PRAGMA foreign_keys"))).scalar_one() == 1


async def test_deleting_goal_clears_focus_session_link(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """목표를 지우면 집중 세션은 남고 goal_id 만 끊긴다 (ON DELETE SET NULL)."""
    token = await _token(client)
    goal_id = (
        await client.post("/api/goals", headers=_h(token), data={"name": "Buddy", "title": "T"})
    ).json()["id"]

    res = await client.post(
        "/api/focus/sessions",
        headers=_h(token),
        json={
            "mode": "stopwatch",
            "seconds": 1800,
            "startedAt": datetime(2026, 9, 20, 1, 0, tzinfo=UTC).isoformat(),
            "goalId": goal_id,
        },
    )
    assert res.status_code == 204

    assert (await client.delete(f"/api/goals/{goal_id}", headers=_h(token))).status_code == 204

    async with session_factory() as db:
        sessions = (await db.execute(select(FocusSession))).scalars().all()
    # 집중한 시간 자체는 사라지면 안 된다 — 목표 연결만 끊긴다
    assert len(sessions) == 1
    assert sessions[0].goal_id is None


async def test_deleting_goal_removes_its_messages(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """메시지는 목표와 함께 지워진다 (ON DELETE CASCADE)."""
    token = await _token(client)
    goal_id = (
        await client.post("/api/goals", headers=_h(token), data={"name": "Buddy", "title": "T"})
    ).json()["id"]

    async with session_factory() as db:
        db.add(Message(goal_id=goal_id, role="user", content="안녕"))
        await db.commit()

    assert (await client.delete(f"/api/goals/{goal_id}", headers=_h(token))).status_code == 204

    async with session_factory() as db:
        assert (await db.execute(select(Message))).scalars().all() == []
