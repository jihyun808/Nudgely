"""완주 판정: complete_goal 도구 + SSE goalCompleted 신호."""

from collections.abc import AsyncIterator

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.streaming import get_reply_streamer
from app.ai.tools import dispatch_tool_call
from app.main import app
from app.models.goal import Goal


async def _token(client: AsyncClient) -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": "a@b.com", "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _make_goal(client: AsyncClient, token: str) -> str:
    res = await client.post("/api/goals", headers=_h(token), data={"name": "Buddy", "title": "T"})
    return res.json()["id"]


# ── 디스패처 단위 ──


async def test_dispatch_complete_goal(client: AsyncClient, session_factory: async_sessionmaker):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        out = await dispatch_tool_call(s, goal, "complete_goal", {})
    assert "완주" in out

    # completed 필터에 등장
    completed = await client.get("/api/goals", headers=_h(token), params={"completed": True})
    ids = [g["id"] for g in completed.json()]
    assert goal_id in ids


async def test_dispatch_complete_goal_idempotent(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)
    await client.post(f"/api/goals/{goal_id}/complete", headers=_h(token))  # 이미 완주

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        out = await dispatch_tool_call(s, goal, "complete_goal", {})
    assert "이미" in out


# ── 대화 통합: SSE goalCompleted ──


class _CompleteStreamer:
    """complete_goal 을 호출한 뒤 축하 문구를 흘리는 가짜 스트리머."""

    async def stream(self, *, dispatch=None, **_) -> AsyncIterator[str]:
        await dispatch("complete_goal", {})
        yield "축하해! 완주야 🎉"


class _PlainStreamer:
    async def stream(self, *, dispatch=None, **_) -> AsyncIterator[str]:
        yield "좋아 계속 가자"


async def test_chat_completion_emits_goal_completed(client: AsyncClient):
    app.dependency_overrides[get_reply_streamer] = lambda: _CompleteStreamer()
    try:
        token = await _token(client)
        goal_id = await _make_goal(client, token)

        res = await client.post(
            f"/api/goals/{goal_id}/messages",
            headers=_h(token),
            json={"content": "나 이거 완주했어!"},
        )
        assert res.status_code == 200
        assert "event: done" in res.text
        assert '"goalCompleted": true' in res.text

        # 실제로 완주 처리됨
        detail = await client.get(f"/api/goals/{goal_id}", headers=_h(token))
        assert detail.json()["completedAt"] is not None
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)


async def test_chat_without_completion_has_no_signal(client: AsyncClient):
    app.dependency_overrides[get_reply_streamer] = lambda: _PlainStreamer()
    try:
        token = await _token(client)
        goal_id = await _make_goal(client, token)

        res = await client.post(
            f"/api/goals/{goal_id}/messages",
            headers=_h(token),
            json={"content": "오늘 뭐하지"},
        )
        assert res.status_code == 200
        assert "event: done" in res.text
        assert "goalCompleted" not in res.text
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)


async def test_chat_already_completed_no_signal(client: AsyncClient):
    app.dependency_overrides[get_reply_streamer] = lambda: _CompleteStreamer()
    try:
        token = await _token(client)
        goal_id = await _make_goal(client, token)
        await client.post(f"/api/goals/{goal_id}/complete", headers=_h(token))  # 이미 완주

        res = await client.post(
            f"/api/goals/{goal_id}/messages",
            headers=_h(token),
            json={"content": "고마워"},
        )
        assert res.status_code == 200
        # 이번 턴에 새로 완주된 게 아니므로 신호 없음
        assert "goalCompleted" not in res.text
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)
