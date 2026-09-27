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
from tests.helpers import auth, create_goal, token_for

CHUNKS = ["오늘은 ", "1강부터 ", "시작해볼까?"]
FULL = "".join(CHUNKS)


class _SlowStreamer:
    """조각 사이에 틈을 둬 '보내는 중에 나가는' 상황을 만든다."""

    async def stream(self, **_) -> AsyncIterator[str]:
        for chunk in CHUNKS:
            await asyncio.sleep(0.02)
            yield chunk


class _GatedStreamer:
    """풀어줄 때까지 첫 조각에서 멈춰 있는 스트리머.

    sleep 으로 버티면 머신이 바쁠 때 그 사이 생성이 끝나 테스트가 흔들린다.
    시간이 아니라 신호로 막아 '아직 만드는 중' 을 확실하게 만든다.
    """

    def __init__(self) -> None:
        #: 첫 조각이 큐에 들어갔다. yield 다음 줄은 제너레이터가 **다시 불릴 때**
        #: 실행되고, 그 전에 부르는 쪽이 큐에 넣는다. 그래서 이 신호는
        #: '큐에 하나 들어간 뒤' 를 정확히 가리킨다.
        self.first_queued = asyncio.Event()
        self.released = asyncio.Event()

    async def stream(self, **_) -> AsyncIterator[str]:
        yield CHUNKS[0]
        self.first_queued.set()
        await self.released.wait()
        for chunk in CHUNKS[1:]:
            yield chunk


async def _assistant_messages(session_factory: async_sessionmaker) -> list[Message]:
    async with session_factory() as db:
        rows = await db.execute(select(Message).where(Message.role == "assistant"))
        return list(rows.scalars().all())


async def _drain(queue, timeout: float = 5.0) -> list:
    """끝 신호(None)가 올 때까지 큐를 비운다. 생성이 끝났음을 확실히 아는 방법이다.

    시간을 재서 기다리면 느린 CI 에서 간헐적으로 떨어진다(실제로 그랬다).
    _run 은 무슨 일이 있어도 마지막에 None 을 보내므로 이걸 기다리면 된다.
    """
    events = []

    async def _read():
        while True:
            event = await queue.get()
            if event is None:
                return
            events.append(event)

    await asyncio.wait_for(_read(), timeout=timeout)
    return events


async def test_reply_completes_with_nobody_listening(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """아무도 큐를 읽지 않아도 생성이 끝까지 돌아 저장돼야 한다.

    채팅방을 나간 상황이 이것이다 — SSE 제너레이터가 사라져 큐를 비우는 사람이
    없어진다. 예전 구조에서는 이 시점에 생성 자체가 취소됐다.

    (진짜 소켓 끊김은 httpx 의 ASGI 트랜스포트가 응답을 버퍼링해 재현되지 않는다.
     그래서 보장 지점인 start_reply 를 직접 친다.)
    """
    token = await token_for(client)
    goal_id = (
        await client.post("/api/goals", headers=auth(token), data={"name": "B", "title": "T"})
    ).json()["id"]

    streamer = _GatedStreamer()
    assistant_id, queue, listener = start_reply(
        session_factory=session_factory,
        streamer=streamer,
        goal_id=goal_id,
        persona=None,
        user_prompt=None,
        goal_title="T",
        history=[("user", "안녕")],
    )

    # start_reply 는 태스크를 만들기만 하고 곧바로 돌아온다. 첫 조각이 큐에
    # 들어갈 때까지 기다린다 — 기다리지 않으면 바쁜 CI 에서 간헐적으로 떨어진다
    # (아직 시작도 안 한 태스크를 두고 "왜 비었냐" 고 묻는 꼴이었다)
    await asyncio.wait_for(streamer.first_queued.wait(), timeout=5.0)

    # 큐를 한 번도 읽지 않는다(= 듣던 사람이 나감).
    # 첫 조각에서 막아 뒀으니 이 시점에는 아직 저장 전이어야 한다.
    assert await _assistant_messages(session_factory) == [], "시작하자마자 끝나 있었다"
    # 아무도 안 읽었는데도 첫 조각이 쌓여 있다(읽는 쪽이 돌아오면 그대로 받는다)
    assert queue.qsize() > 0

    streamer.released.set()
    await _drain(queue)

    messages = await _assistant_messages(session_factory)
    assert messages, "듣는 사람이 없자 생성이 멈췄다"
    assert messages[0].id == assistant_id
    # 끊긴 시점까지가 아니라 끝까지 만들어진 답이어야 한다
    assert messages[0].content == FULL


async def test_reply_is_saved_once(client: AsyncClient, session_factory: async_sessionmaker):
    """끝까지 들은 경우에도 메시지는 하나만 저장된다."""
    app.dependency_overrides[get_reply_streamer] = lambda: _SlowStreamer()
    try:
        token = await token_for(client)
        goal_id = (
            await client.post("/api/goals", headers=auth(token), data={"name": "B", "title": "T"})
        ).json()["id"]

        res = await client.post(
            f"/api/goals/{goal_id}/messages", headers=auth(token), json={"content": "안녕"}
        )
        # 응답을 끝까지 받았다는 건 생성·저장이 끝났다는 뜻이다(done 이 마지막)
        assert "event: done" in res.text

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
        token = await token_for(client)
        goal_id = (
            await client.post("/api/goals", headers=auth(token), data={"name": "B", "title": "T"})
        ).json()["id"]

        res = await client.post(
            f"/api/goals/{goal_id}/messages", headers=auth(token), json={"content": "안녕"}
        )

        assert "AI_EMPTY" in res.text
        assert await _assistant_messages(session_factory) == []
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)


async def test_save_failure_still_ends_the_stream(
    client: AsyncClient, session_factory: async_sessionmaker, monkeypatch
):
    """저장 단계에서 터져도 끝 신호는 나가야 한다.

    예전에는 try/except 가 스트리밍 루프만 감싸서, commit 에서 예외가 나면
    큐에 None 이 안 들어갔다. SSE 를 중계하는 쪽은 queue.get() 에서 영원히
    기다리고, 태스크 예외는 아무도 보지 않았다(원인도 안 남았다).
    """
    token = await token_for(client, "save@b.com")
    goal_id = await create_goal(client, token)

    def boom(*_args, **_kwargs):
        raise RuntimeError("디스크가 꽉 찼다")

    monkeypatch.setattr("app.services.reply_service.split_bubbles", boom)

    _assistant_id, queue, _listener = start_reply(
        session_factory=session_factory,
        streamer=_SlowStreamer(),
        goal_id=goal_id,
        persona=None,
        user_prompt=None,
        goal_title="T",
        history=[("user", "안녕")],
    )

    # 끝 신호가 오지 않으면 여기서 타임아웃으로 실패한다
    events = await _drain(queue, timeout=3.0)

    assert any(name == "error" for name, _ in events), "실패를 알리지 않았다"
    assert await _assistant_messages(session_factory) == []
