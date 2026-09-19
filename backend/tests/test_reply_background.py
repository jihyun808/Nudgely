"""응답 생성이 클라이언트와 분리돼 있는지 (백그라운드 생성).

답이 오는 중에 채팅방을 나가면 SSE 가 끊긴다. 예전에는 그 순간 제너레이터가
취소돼 assistant 메시지가 통째로 사라졌다 — 저장이 스트리밍 맨 끝에 있었다.
도구는 각자 바로 커밋하므로 '투두는 생겼는데 AI 말은 없는' 상태가 남았다.
"""

import asyncio
from collections.abc import AsyncIterator

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.streaming import get_reply_streamer
from app.main import app
from app.models.goal import Message
from app.services.reply_service import start_reply

CHUNKS = ["오늘은 ", "1강부터 ", "시작해볼까?"]
FULL = "".join(CHUNKS)


class _SlowStreamer:
    """조각 사이에 틈을 둬 '보내는 중에 나가는' 상황을 만든다."""

    async def stream(self, **_) -> AsyncIterator[str]:
        for chunk in CHUNKS:
            await asyncio.sleep(0.08)
            yield chunk


async def _token(client: AsyncClient) -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": "bg@b.com", "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _assistant_messages(session_factory: async_sessionmaker) -> list[Message]:
    async with session_factory() as db:
        rows = await db.execute(select(Message).where(Message.role == "assistant"))
        return list(rows.scalars().all())


async def _wait_for_assistant(session_factory: async_sessionmaker, timeout: float = 3.0):
    """백그라운드 생성이 끝나 저장될 때까지 기다린다."""
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        messages = await _assistant_messages(session_factory)
        if messages:
            return messages[0]
        await asyncio.sleep(0.02)
    return None


async def test_reply_completes_with_nobody_listening(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """아무도 큐를 읽지 않아도 생성이 끝까지 돌아 저장돼야 한다.

    채팅방을 나간 상황이 이것이다 — SSE 제너레이터가 사라져 큐를 비우는 사람이
    없어진다. 예전 구조에서는 이 시점에 생성 자체가 취소됐다.

    (진짜 소켓 끊김은 httpx 의 ASGI 트랜스포트가 응답을 버퍼링해 재현되지 않는다.
     그래서 보장 지점인 start_reply 를 직접 친다.)
    """
    token = await _token(client)
    goal_id = (
        await client.post("/api/goals", headers=_h(token), data={"name": "B", "title": "T"})
    ).json()["id"]

    assistant_id, queue = start_reply(
        session_factory=session_factory,
        streamer=_SlowStreamer(),
        goal_id=goal_id,
        persona=None,
        user_prompt=None,
        goal_title="T",
        history=[("user", "안녕")],
    )

    # 큐를 한 번도 읽지 않는다(= 듣던 사람이 나감)
    assert await _assistant_messages(session_factory) == [], "시작하자마자 끝나 있었다"

    saved = await _wait_for_assistant(session_factory)

    assert saved is not None, "듣는 사람이 없자 생성이 멈췄다"
    assert saved.id == assistant_id
    # 끊긴 시점까지가 아니라 끝까지 만들어진 답이어야 한다
    assert saved.content == FULL
    # 큐에는 쌓여 있다(읽는 쪽이 돌아오면 그대로 받는다)
    assert queue.qsize() > 0


async def test_reply_is_saved_once(client: AsyncClient, session_factory: async_sessionmaker):
    """끝까지 들은 경우에도 메시지는 하나만 저장된다."""
    app.dependency_overrides[get_reply_streamer] = lambda: _SlowStreamer()
    try:
        token = await _token(client)
        goal_id = (
            await client.post("/api/goals", headers=_h(token), data={"name": "B", "title": "T"})
        ).json()["id"]

        res = await client.post(
            f"/api/goals/{goal_id}/messages", headers=_h(token), json={"content": "안녕"}
        )
        assert "event: done" in res.text

        await asyncio.sleep(0.05)
        messages = await _assistant_messages(session_factory)
        assert len(messages) == 1
        assert messages[0].content == FULL
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)


async def test_empty_reply_is_not_saved(client: AsyncClient, session_factory: async_sessionmaker):
    """빈 응답을 저장하면 말풍선만 덩그러니 남는다."""

    class _EmptyStreamer:
        async def stream(self, **_) -> AsyncIterator[str]:
            return
            yield  # pragma: no cover

    app.dependency_overrides[get_reply_streamer] = lambda: _EmptyStreamer()
    try:
        token = await _token(client)
        goal_id = (
            await client.post("/api/goals", headers=_h(token), data={"name": "B", "title": "T"})
        ).json()["id"]

        res = await client.post(
            f"/api/goals/{goal_id}/messages", headers=_h(token), json={"content": "안녕"}
        )

        assert "AI_EMPTY" in res.text
        assert await _assistant_messages(session_factory) == []
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)
