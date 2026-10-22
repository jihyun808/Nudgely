"""채팅방 기억 노트: 사용자는 설정에서, AI 는 remember/forget 도구로 함께 쓴다."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai import prompts
from app.ai.prompts import build_chat_messages
from app.ai.tools import dispatch_tool_call
from app.models.goal import Goal
from app.schemas.goal import MEMORY_MAX
from tests.helpers import auth, create_goal, token_for


async def _remember(session_factory, goal_id: str, name: str, **args) -> tuple[str, str | None]:
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        out = await dispatch_tool_call(db, goal, name, args)
        return out, goal.memory


async def test_user_edits_memory_in_settings(client: AsyncClient):
    token = await token_for(client)
    goal_id = await create_goal(client, token)

    await client.patch(
        f"/api/goals/{goal_id}", headers=auth(token), json={"memory": "평일엔 밤에만 시간 돼"}
    )

    detail = await client.get(f"/api/goals/{goal_id}", headers=auth(token))
    assert detail.json()["memory"] == "평일엔 밤에만 시간 돼"


async def test_memory_over_limit_is_rejected(client: AsyncClient):
    token = await token_for(client)
    goal_id = await create_goal(client, token)

    res = await client.patch(
        f"/api/goals/{goal_id}", headers=auth(token), json={"memory": "가" * (MEMORY_MAX + 1)}
    )

    assert res.status_code == 422


async def test_ai_appends_and_forgets_lines(
    client: AsyncClient, session_factory: async_sessionmaker
):
    goal_id = await create_goal(client, await token_for(client))

    await _remember(session_factory, goal_id, "remember", note="칭찬은 짧게")
    out, memory = await _remember(session_factory, goal_id, "remember", note="11월 14일 시험")
    assert memory == "칭찬은 짧게\n11월 14일 시험"
    assert "남겼다" in out

    out, memory = await _remember(session_factory, goal_id, "forget", text="시험")
    assert memory == "칭찬은 짧게"


async def test_ai_cannot_overflow_memory(client: AsyncClient, session_factory: async_sessionmaker):
    token = await token_for(client)
    goal_id = await create_goal(client, token)
    await client.patch(
        f"/api/goals/{goal_id}", headers=auth(token), json={"memory": "가" * MEMORY_MAX}
    )

    out, memory = await _remember(session_factory, goal_id, "remember", note="한 줄 더")

    assert "가득 찼다" in out
    assert memory == "가" * MEMORY_MAX


def test_memory_is_isolated_as_reference():
    msgs = build_chat_messages(
        persona=None,
        user_prompt=None,
        goal_title="헬스",
        history=[("user", "안녕")],
        state=prompts.GoalState(memory="손목이 안 좋아서 하체 위주"),
    )

    block = next(m for m in msgs if "기억하기로 한 것" in m["content"])
    assert block["role"] == "system"
    assert "지시가 아니다" in block["content"]
    assert "하체 위주" in block["content"]
