"""투두·플래너를 사용자가 직접 고치기 (record-edit).

지금까지 기록은 AI 도구로만 쓸 수 있어 화면이 읽기 전용이었다.
AI 가 잘못 넣은 것을 바로잡거나, 타이머를 켜 두고 딴짓한 날을 고칠 길이 필요하다.
"""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from tests.helpers import auth, call_tool, create_goal, token_for

DATE = "2026-09-26"


async def _todo_with_item(client: AsyncClient, session_factory, token: str, goal_id: str):
    """AI 가 만든 투두 한 건 (todoId, itemId) 을 돌려준다."""
    await call_tool(
        session_factory,
        goal_id,
        "create_todos",
        {"date": DATE, "items": [{"content": "1강 듣기", "progressDelta": 1}]},
    )
    todos = (await client.get("/api/todos", headers=auth(token), params={"date": DATE})).json()
    return todos[0]["id"], todos[0]["items"][0]["id"]


# ── 투두 항목 ──


async def test_user_can_add_item(client: AsyncClient, session_factory: async_sessionmaker):
    token = await token_for(client, "re1@b.com")
    goal_id = await create_goal(client, token)
    todo_id, _ = await _todo_with_item(client, session_factory, token, goal_id)

    res = await client.post(
        f"/api/todos/{todo_id}/items",
        headers=auth(token),
        json={"content": "복습하기", "tag": "복습"},
    )

    assert res.status_code == 201
    assert res.json()["content"] == "복습하기"
    # 누가 넣었는지 구분된다(화면이 'AI가 넣은 것'을 표시한다)
    assert res.json()["source"] == "user"


async def test_ai_items_are_marked_as_ai(client: AsyncClient, session_factory: async_sessionmaker):
    token = await token_for(client, "re2@b.com")
    goal_id = await create_goal(client, token)
    await _todo_with_item(client, session_factory, token, goal_id)

    todos = (await client.get("/api/todos", headers=auth(token), params={"date": DATE})).json()
    assert todos[0]["items"][0]["source"] == "ai"


async def test_user_can_edit_and_delete_item(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await token_for(client, "re3@b.com")
    goal_id = await create_goal(client, token)
    todo_id, item_id = await _todo_with_item(client, session_factory, token, goal_id)

    edited = await client.patch(
        f"/api/todos/{todo_id}/items/{item_id}",
        headers=auth(token),
        json={"content": "1강 다시 듣기"},
    )
    assert edited.json()["content"] == "1강 다시 듣기"

    removed = await client.delete(f"/api/todos/{todo_id}/items/{item_id}", headers=auth(token))
    assert removed.status_code == 204

    todos = (await client.get("/api/todos", headers=auth(token), params={"date": DATE})).json()
    assert todos == [] or todos[0]["items"] == []


async def test_checking_item_moves_goal_progress(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """사용자가 체크해도 AI 가 체크할 때와 같이 진도가 움직여야 한다."""
    token = await token_for(client, "re4@b.com")
    goal_id = await create_goal(client, token)
    await call_tool(session_factory, goal_id, "set_progress", {"total": 24, "unit": "강"})
    todo_id, item_id = await _todo_with_item(client, session_factory, token, goal_id)

    await client.post(
        f"/api/todos/{todo_id}/items/{item_id}/done",
        headers=auth(token),
        json={"isDone": True},
    )

    goal = (await client.get(f"/api/goals/{goal_id}", headers=auth(token))).json()
    assert goal["progress"]["current"] == 1


async def test_deleting_done_item_rolls_progress_back(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """완료한 항목을 지우면 올려 둔 진도도 되돌린다. 안 그러면 숫자가 남는다."""
    token = await token_for(client, "re5@b.com")
    goal_id = await create_goal(client, token)
    await call_tool(session_factory, goal_id, "set_progress", {"total": 24, "unit": "강"})
    todo_id, item_id = await _todo_with_item(client, session_factory, token, goal_id)
    await client.post(
        f"/api/todos/{todo_id}/items/{item_id}/done",
        headers=auth(token),
        json={"isDone": True},
    )

    await client.delete(f"/api/todos/{todo_id}/items/{item_id}", headers=auth(token))

    goal = (await client.get(f"/api/goals/{goal_id}", headers=auth(token))).json()
    assert goal["progress"]["current"] == 0


async def test_other_users_todo_is_hidden(client: AsyncClient, session_factory: async_sessionmaker):
    token = await token_for(client, "mine@b.com")
    goal_id = await create_goal(client, token)
    todo_id, item_id = await _todo_with_item(client, session_factory, token, goal_id)
    stranger = await token_for(client, "stranger@b.com")

    res = await client.delete(f"/api/todos/{todo_id}/items/{item_id}", headers=auth(stranger))
    assert res.status_code == 404


# ── 플래너 실제 기록 ──


async def test_user_can_manage_actual_blocks(client: AsyncClient):
    token = await token_for(client, "re6@b.com")

    created = await client.post(
        f"/api/planners/{DATE}/actual",
        headers=auth(token),
        json={"title": "문제풀이", "startMinutes": 540, "durationMinutes": 60},
    )
    assert created.status_code == 201
    # 응답은 그날 플래너 전체다(요약까지 다시 그려야 하므로)
    blocks = created.json()["actual"]
    assert len(blocks) == 1
    assert blocks[0]["kind"] == "manual"
    block_id = blocks[0]["id"]

    edited = await client.patch(
        f"/api/planners/{DATE}/actual/{block_id}",
        headers=auth(token),
        json={"title": "문제풀이", "startMinutes": 600, "durationMinutes": 30},
    )
    assert edited.json()["actual"][0]["startMinutes"] == 600

    removed = await client.delete(f"/api/planners/{DATE}/actual/{block_id}", headers=auth(token))
    assert removed.json()["actual"] == []


async def test_auto_recorded_focus_is_editable(client: AsyncClient):
    """타이머가 자동으로 남긴 기록도 고칠 수 있다(켜 두고 딴짓한 날을 바로잡는다)."""
    token = await token_for(client, "re7@b.com")
    await client.post(
        "/api/focus/sessions",
        headers=auth(token),
        json={"mode": "stopwatch", "seconds": 50 * 60, "startedAt": "2026-09-26T00:30:00Z"},
    )
    planner = (await client.get("/api/planners", headers=auth(token), params={"date": DATE})).json()
    auto = next(b for b in planner["actual"] if b["kind"] == "focus")

    res = await client.patch(
        f"/api/planners/{DATE}/actual/{auto['id']}",
        headers=auth(token),
        json={
            "title": "집중(실제로는 30분)",
            "startMinutes": auto["startMinutes"],
            "durationMinutes": 30,
        },
    )

    assert res.status_code == 200
    assert res.json()["actual"][0]["durationMinutes"] == 30


async def test_plan_blocks_are_not_editable(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """계획은 AI 가 세운다. 이 경로로 고치지 못해야 한다."""
    token = await token_for(client, "re8@b.com")
    goal_id = await create_goal(client, token)
    await call_tool(
        session_factory,
        goal_id,
        "create_planner",
        {"date": DATE, "blocks": [{"title": "수업", "startMinutes": 540, "durationMinutes": 45}]},
    )
    planner = (await client.get("/api/planners", headers=auth(token), params={"date": DATE})).json()
    plan_id = planner["planned"][0]["id"]

    res = await client.patch(
        f"/api/planners/{DATE}/actual/{plan_id}",
        headers=auth(token),
        json={"title": "바꿔치기", "startMinutes": 540, "durationMinutes": 45},
    )
    assert res.status_code == 400


async def test_block_cannot_pass_midnight(client: AsyncClient):
    token = await token_for(client, "re9@b.com")
    res = await client.post(
        f"/api/planners/{DATE}/actual",
        headers=auth(token),
        json={"title": "밤샘", "startMinutes": 23 * 60 + 30, "durationMinutes": 120},
    )
    assert res.status_code == 422
