"""AI 도구 디스패처 · 대화 통합 테스트 (키 없이)."""

from collections.abc import AsyncIterator
from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.streaming import get_reply_streamer
from app.ai.tools import dispatch_tool_call
from app.main import app
from app.models.goal import Goal
from app.services.goal_service import set_progress
from app.services.record_service import create_daily_todo


async def _token(client: AsyncClient, email: str = "a@b.com") -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": email, "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _make_goal(client: AsyncClient, token: str) -> str:
    res = await client.post(
        "/api/goals", headers=_h(token), data={"name": "Buddy", "title": "UI/UX 완주"}
    )
    return res.json()["id"]


# ── 디스패처 단위 ──


async def test_dispatch_create_todos(client: AsyncClient, session_factory: async_sessionmaker):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        out = await dispatch_tool_call(
            s,
            goal,
            "create_todos",
            {
                "date": "2026-08-03",
                "items": [
                    {"content": "21강 수강", "tag": "강의", "progressDelta": 1},
                    {"content": "복습"},
                ],
            },
        )
    assert "2개" in out

    got = await client.get("/api/todos", headers=_h(token), params={"date": "2026-08-03"})
    items = got.json()[0]["items"]
    assert [i["content"] for i in items] == ["21강 수강", "복습"]
    assert items[0]["tag"] == "강의"


async def test_dispatch_set_progress(client: AsyncClient, session_factory: async_sessionmaker):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        await dispatch_tool_call(
            s, goal, "set_progress", {"total": 50, "unit": "강", "current": 21}
        )

    detail = await client.get(f"/api/goals/{goal_id}", headers=_h(token))
    assert detail.json()["progress"] == {"current": 21, "total": 50, "unit": "강"}


async def test_dispatch_check_todo_updates_progress(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        set_progress(goal, total=50, unit="강")
        todo = await create_daily_todo(
            s, goal, date(2026, 8, 3), [{"content": "22~24강", "progress_delta": 3}]
        )
        await s.commit()
        item_id = todo.items[0].id

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        out = await dispatch_tool_call(
            s, goal, "check_todo_item", {"itemId": item_id, "done": True}
        )
    assert "갱신" in out

    detail = await client.get(f"/api/goals/{goal_id}", headers=_h(token))
    assert detail.json()["progress"]["current"] == 3


async def test_dispatch_check_todo_wrong_goal(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    g1 = await _make_goal(client, token)
    g2 = (
        await client.post("/api/goals", headers=_h(token), data={"name": "B2", "title": "T2"})
    ).json()["id"]

    async with session_factory() as s:
        goal1 = await s.get(Goal, g1)
        todo = await create_daily_todo(s, goal1, date(2026, 8, 3), [{"content": "x"}])
        await s.commit()
        item_id = todo.items[0].id

    # g2 목표로 g1 의 항목을 체크 시도 → 거부
    async with session_factory() as s:
        goal2 = await s.get(Goal, g2)
        out = await dispatch_tool_call(s, goal2, "check_todo_item", {"itemId": item_id})
    assert "아니다" in out


async def test_dispatch_create_planner(client: AsyncClient, session_factory: async_sessionmaker):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        await dispatch_tool_call(
            s,
            goal,
            "create_planner",
            {
                "date": "2026-08-03",
                "blocks": [{"title": "미라클 모닝", "startMinutes": 480, "durationMinutes": 40}],
            },
        )

    got = await client.get("/api/planners", headers=_h(token), params={"date": "2026-08-03"})
    body = got.json()
    assert len(body["planned"]) == 1
    assert body["planned"][0]["startMinutes"] == 480


async def test_dispatch_set_milestones(client: AsyncClient, session_factory: async_sessionmaker):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        await dispatch_tool_call(
            s,
            goal,
            "set_milestones",
            {"milestones": [{"title": "기초 10강", "status": "done"}, {"title": "완주"}]},
        )

    got = await client.get(f"/api/goals/{goal_id}/progress", headers=_h(token))
    ms = got.json()["milestones"]
    assert [m["title"] for m in ms] == ["기초 10강", "완주"]
    assert ms[0]["status"] == "done"


async def test_dispatch_unknown_tool(client: AsyncClient, session_factory: async_sessionmaker):
    token = await _token(client)
    goal_id = await _make_goal(client, token)
    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        out = await dispatch_tool_call(s, goal, "nope", {})
    assert "알 수 없는 도구" in out


# ── 대화 통합: 스트리머가 도구를 호출 ──


class _ToolStreamer:
    """도구를 먼저 호출한 뒤 텍스트를 흘리는 가짜 스트리머."""

    def __init__(self, calls: list[tuple[str, dict]], chunks: list[str]) -> None:
        self._calls = calls
        self._chunks = chunks

    async def stream(self, *, dispatch=None, **_) -> AsyncIterator[str]:
        for name, args in self._calls:
            await dispatch(name, args)
        for c in self._chunks:
            yield c


async def test_chat_dispatches_tool_and_streams(client: AsyncClient):
    calls = [
        (
            "create_todos",
            {"date": "2026-08-03", "items": [{"content": "오늘 3강", "progressDelta": 3}]},
        )
    ]
    app.dependency_overrides[get_reply_streamer] = lambda: _ToolStreamer(
        calls, ["좋아, ", "투두 만들었어!"]
    )
    try:
        token = await _token(client)
        goal_id = await _make_goal(client, token)

        res = await client.post(
            f"/api/goals/{goal_id}/messages",
            headers=_h(token),
            json={"content": "오늘 3강 들을래"},
        )
        assert res.status_code == 200
        assert "투두 만들었어!" in res.text
        assert "event: done" in res.text

        # 도구가 실제로 투두를 만들었는지
        todos = await client.get("/api/todos", headers=_h(token), params={"date": "2026-08-03"})
        assert todos.json()[0]["items"][0]["content"] == "오늘 3강"
    finally:
        app.dependency_overrides.pop(get_reply_streamer, None)
