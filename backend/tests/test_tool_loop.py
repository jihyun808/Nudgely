"""도구 호출 루프의 예외·재시도·타임아웃 (B-5).

도구가 터지거나 모델 호출이 실패해도 **대화 자체가 끊기면 안 된다.**
여기서 예외가 새면 라우터가 SSE error 로 감싸 사용자는 '전송 실패' 만 본다.
"""

import asyncio

import pytest
from httpx import AsyncClient
from openai import APIConnectionError
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai import streaming
from app.ai.tools import dispatch_tool_call
from app.models.goal import Goal
from tests.helpers import CONSENTS


class _FakeMessage:
    def __init__(self, tool_calls=None):
        self.tool_calls = tool_calls

    def model_dump(self, **_):
        return {"role": "assistant", "content": None}


async def _goal(client: AsyncClient, session_factory: async_sessionmaker) -> Goal:
    token = (
        await client.post(
            "/api/auth/signup",
            json={"nickname": "지수", "email": "loop@b.com", "password": "password123", **CONSENTS},
        )
    ).json()["accessToken"]
    goal_id = (
        await client.post(
            "/api/goals",
            headers={"Authorization": f"Bearer {token}"},
            data={"name": "Buddy", "title": "UIUX"},
        )
    ).json()["id"]
    async with session_factory() as db:
        return await db.get(Goal, goal_id)


# ── 디스패처가 예외를 밖으로 내보내지 않는지 ──


async def test_tool_crash_is_reported_not_raised(
    client: AsyncClient, session_factory: async_sessionmaker, monkeypatch
):
    """도구 안에서 예상 못 한 예외가 나도 문자열로 돌려준다."""
    goal = await _goal(client, session_factory)

    async def boom(*_args, **_kwargs):
        raise RuntimeError("DB 가 잠겼다")

    monkeypatch.setattr("app.ai.tools.add_todo_items", boom)

    async with session_factory() as db:
        out = await dispatch_tool_call(
            db,
            await db.get(Goal, goal.id),
            "create_todos",
            {"date": "2026-09-20", "items": [{"content": "1강"}]},
        )

    assert "실패했다" in out
    assert "RuntimeError" in out


# ── 도구 라운드 재시도·타임아웃 ──


class _FlakyClient:
    """처음 n 번은 일시적 오류로 실패하고 그 뒤 성공하는 가짜 클라이언트."""

    def __init__(self, fail_times: int):
        self.fail_times = fail_times
        self.calls = 0
        self.chat = self

    @property
    def completions(self):
        return self

    async def create(self, **_kwargs):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise APIConnectionError(request=None)

        class _Resp:
            choices = [type("C", (), {"message": _FakeMessage()})()]

        return _Resp()


async def test_tool_round_retries_transient_error(monkeypatch):
    """연결 오류는 한 번 더 시도한다."""
    monkeypatch.setattr(streaming, "RETRY_BACKOFF_SECONDS", 0)
    fake = _FlakyClient(fail_times=1)

    msg = await streaming._tool_round(fake, "gpt-test", [])

    assert msg is not None
    assert fake.calls == 2  # 실패 1 + 성공 1


async def test_tool_round_gives_up_after_retries(monkeypatch):
    """계속 실패하면 None 을 돌려 도구 없이 답을 이어가게 한다."""
    monkeypatch.setattr(streaming, "RETRY_BACKOFF_SECONDS", 0)
    fake = _FlakyClient(fail_times=99)

    msg = await streaming._tool_round(fake, "gpt-test", [])

    assert msg is None
    assert fake.calls == streaming.TOOL_ROUND_RETRIES + 1


async def test_tool_round_times_out(monkeypatch):
    """한 라운드가 멈춰 있으면 기다리지 않고 포기한다."""
    monkeypatch.setattr(streaming, "TOOL_ROUND_TIMEOUT", 0.05)
    monkeypatch.setattr(streaming, "RETRY_BACKOFF_SECONDS", 0)

    class _HangingClient:
        def __init__(self):
            self.chat = self
            self.calls = 0

        @property
        def completions(self):
            return self

        async def create(self, **_kwargs):
            self.calls += 1
            await asyncio.sleep(10)

    fake = _HangingClient()
    msg = await asyncio.wait_for(streaming._tool_round(fake, "gpt-test", []), timeout=2)

    assert msg is None


async def test_permanent_error_is_not_retried(monkeypatch):
    """키가 틀린 것처럼 다시 해도 같은 오류는 한 번만 시도한다."""
    monkeypatch.setattr(streaming, "RETRY_BACKOFF_SECONDS", 0)

    class _BrokenClient:
        def __init__(self):
            self.chat = self
            self.calls = 0

        @property
        def completions(self):
            return self

        async def create(self, **_kwargs):
            self.calls += 1
            raise ValueError("OPENAI_API_KEY 가 없다")

    fake = _BrokenClient()
    assert await streaming._tool_round(fake, "gpt-test", []) is None
    assert fake.calls == 1


@pytest.mark.parametrize("rounds", [streaming.MAX_TOOL_ROUNDS])
async def test_max_rounds_is_bounded(rounds: int):
    """무한 루프 방지 상한이 살아 있는지."""
    assert 1 <= rounds <= 10


async def test_tool_failure_is_told_to_the_model_and_user(monkeypatch):
    """도구를 못 썼는데 모델이 "투두에 넣었어" 라고 하면 사용자는 빈 기록 탭을 본다."""
    seen: list[dict] = []

    async def fails(*_args, **_kwargs):
        return None

    monkeypatch.setattr(streaming, "_tool_round", fails)

    class _Client:
        def __init__(self):
            self.chat = self
            self.completions = self

        async def create(self, **kwargs):
            seen.extend(kwargs["messages"])

            async def _empty():
                return
                yield

            return _empty()

    monkeypatch.setattr("app.ai.client.get_openai_client", lambda: _Client())

    streamer = streaming.OpenAIReplyStreamer()
    async for _ in streamer.stream(
        persona=None,
        user_prompt=None,
        goal_title="T",
        history=[("user", "투두 넣어줘")],
        dispatch=lambda *_: None,
    ):
        pass

    assert streamer.tool_failed is True
    assert any("저장했다고 말하지 마라" in str(m.get("content")) for m in seen)
