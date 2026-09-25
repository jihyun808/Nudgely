"""투두 도구 — 읽기·중복 방지 (AI 가 같은 할 일을 계속 만들던 문제).

실제로 이런 일이 있었다: 사용자가 "투두 체크 안해줭?" 하자 AI 가 itemId 를
알 방법이 없어 실패했고("항목을 찾는 데 문제가 발생"), 없는 줄 알고
create_todos 를 다시 불러 같은 3개가 4초 간격으로 중복 저장됐다.

원인은 **읽기 도구가 없던 것**이다. check_todo_item 은 itemId 를 필수로 받는데
모델에게 id 를 알려주는 경로가 하나도 없었다.
"""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.tools import TOOL_SCHEMAS
from app.models.todo import TodoItem
from tests.helpers import call_tool, create_goal, token_for

DATE = "2026-09-20"


async def _goal(client: AsyncClient, _session_factory=None) -> str:
    token = await token_for(client, "todo@b.com")
    return await create_goal(client, token, name="선대냥이", title="선형대수")


def test_list_todos_tool_exists():
    """읽기 도구가 없으면 check_todo_item 은 쓸 수 없는 도구다."""
    assert "list_todos" in {t["function"]["name"] for t in TOOL_SCHEMAS}


async def test_create_todos_returns_item_ids(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """만든 직후 바로 체크할 수 있어야 한다. id 를 안 주면 모델이 지어낸다."""
    goal_id = await _goal(client, session_factory)
    out = await call_tool(
        session_factory,
        goal_id,
        "create_todos",
        {"date": DATE, "items": [{"content": "1강 듣기"}]},
    )

    assert "itemId=" in out
    async with session_factory() as db:
        item = (await db.execute(select(TodoItem))).scalars().one()
    assert item.id in out


async def test_list_todos_shows_ids_and_state(
    client: AsyncClient, session_factory: async_sessionmaker
):
    goal_id = await _goal(client, session_factory)
    await call_tool(
        session_factory,
        goal_id,
        "create_todos",
        {"date": DATE, "items": [{"content": "1강 듣기"}, {"content": "정리"}]},
    )

    out = await call_tool(session_factory, goal_id, "list_todos", {"date": DATE})

    assert "1강 듣기" in out
    assert "정리" in out
    assert out.count("itemId=") == 2
    assert "미완료" in out


async def test_listed_id_can_be_checked(client: AsyncClient, session_factory: async_sessionmaker):
    """list_todos → check_todo_item 이 실제로 이어져야 한다."""
    goal_id = await _goal(client, session_factory)
    await call_tool(
        session_factory,
        goal_id,
        "create_todos",
        {"date": DATE, "items": [{"content": "1강 듣기", "progressDelta": 1}]},
    )
    async with session_factory() as db:
        item_id = (await db.execute(select(TodoItem.id))).scalars().one()

    out = await call_tool(session_factory, goal_id, "check_todo_item", {"itemId": item_id})

    assert "갱신했다" in out
    listed = await call_tool(session_factory, goal_id, "list_todos", {"date": DATE})
    assert "완료" in listed


async def test_duplicate_content_is_skipped(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """같은 날 같은 내용은 쌓이지 않는다(중복 저장 재현 방지)."""
    goal_id = await _goal(client, session_factory)
    items = [{"content": "1-1 소주제 수업"}, {"content": "1-1 소주제 정리"}]

    await call_tool(session_factory, goal_id, "create_todos", {"date": DATE, "items": items})
    out = await call_tool(session_factory, goal_id, "create_todos", {"date": DATE, "items": items})

    assert "이미 같은 할 일이 있어" in out
    async with session_factory() as db:
        assert len((await db.execute(select(TodoItem))).scalars().all()) == 2


async def test_partial_duplicate_adds_only_new(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """일부만 겹치면 새 것만 넣고 몇 개 건너뛰었는지 알린다."""
    goal_id = await _goal(client, session_factory)
    await call_tool(
        session_factory, goal_id, "create_todos", {"date": DATE, "items": [{"content": "수업"}]}
    )

    out = await call_tool(
        session_factory,
        goal_id,
        "create_todos",
        {"date": DATE, "items": [{"content": "수업"}, {"content": "문제풀이"}]},
    )

    assert "건너뛴 것 1개" in out
    async with session_factory() as db:
        contents = (await db.execute(select(TodoItem.content))).scalars().all()
    assert sorted(contents) == ["문제풀이", "수업"]


async def test_unknown_item_id_points_to_list_todos(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """없는 id 로 체크하면 '만들어라' 가 아니라 '읽어라' 로 유도해야 한다."""
    goal_id = await _goal(client, session_factory)
    out = await call_tool(session_factory, goal_id, "check_todo_item", {"itemId": "ti_없는것"})

    assert "list_todos" in out
    assert "새로 만들지도 마라" in out


async def test_list_todos_on_empty_day(client: AsyncClient, session_factory: async_sessionmaker):
    goal_id = await _goal(client, session_factory)
    out = await call_tool(session_factory, goal_id, "list_todos", {"date": DATE})
    assert "투두가 없다" in out


async def test_duplicate_within_one_call_is_skipped(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """한 호출 안에 같은 내용이 두 번 들어와도 하나만 만든다.

    그날 첫 생성이면 기존 항목이 없어 중복 검사를 건너뛰던 구멍이 있었다.
    """
    goal_id = await _goal(client, session_factory)
    out = await call_tool(
        session_factory,
        goal_id,
        "create_todos",
        {"date": DATE, "items": [{"content": "수업"}, {"content": "수업"}]},
    )

    assert "건너뛴 것 1개" in out
    async with session_factory() as db:
        assert (await db.execute(select(TodoItem.content))).scalars().all() == ["수업"]


async def test_all_duplicates_on_fresh_day_leaves_nothing(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """전부 중복이면 빈 묶음만 남지 않도록 롤백된다."""
    from app.models.todo import Todo

    goal_id = await _goal(client, session_factory)
    await call_tool(
        session_factory, goal_id, "create_todos", {"date": DATE, "items": [{"content": "수업"}]}
    )
    await call_tool(
        session_factory, goal_id, "create_todos", {"date": DATE, "items": [{"content": "수업"}]}
    )

    async with session_factory() as db:
        todos = (await db.execute(select(Todo))).scalars().all()
        items = (await db.execute(select(TodoItem))).scalars().all()
    assert len(todos) == 1
    assert len(items) == 1
