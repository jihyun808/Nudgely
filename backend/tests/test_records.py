"""기록(투두) 조회 · 진도 연동 테스트."""

from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.goal import Goal
from app.models.todo import TodoItem
from app.services.goal_service import apply_progress_delta, set_progress
from app.services.record_service import create_daily_todo, set_item_done

# ── 진도 순수 함수 (ai-plan §4.3b) ──


def test_set_progress_sets_and_clamps():
    g = Goal(name="x")
    set_progress(g, total=50, unit="강")
    assert g.progress == {"current": 0, "total": 50, "unit": "강"}

    set_progress(g, current=30)
    assert g.progress["current"] == 30

    set_progress(g, current=999)  # total 초과 → 50 으로 클램프
    assert g.progress["current"] == 50


def test_delta_noop_until_initialized():
    g = Goal(name="x")
    apply_progress_delta(g, 3)  # progress 미초기화 → 무시
    assert g.progress is None


def test_delta_applies_and_clamps_low():
    g = Goal(name="x")
    set_progress(g, total=50, unit="강")
    apply_progress_delta(g, 3)
    assert g.progress["current"] == 3
    apply_progress_delta(g, -5)  # 0 아래로 → 0 클램프
    assert g.progress["current"] == 0


# ── HTTP 통합 ──


async def _token(client: AsyncClient, email: str = "a@b.com") -> str:
    res = await client.post(
        "/api/auth/signup",
        json={"nickname": "지수", "email": email, "password": "password123"},
    )
    return res.json()["accessToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _make_goal(client: AsyncClient, token: str, title: str = "UI/UX 완주") -> str:
    res = await client.post("/api/goals", headers=_h(token), data={"name": "Buddy", "title": title})
    return res.json()["id"]


async def test_daily_todos_by_date(client: AsyncClient, session_factory: async_sessionmaker):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        await create_daily_todo(
            s,
            goal,
            date(2026, 8, 3),
            [
                {"content": "UI/UX 21강 수강", "tag": "강의", "progress_delta": 1},
                {"content": "오답노트 정리", "tag": "복습", "progress_delta": 0},
            ],
        )
        await create_daily_todo(s, goal, date(2026, 8, 4), [{"content": "다른 날"}])
        await s.commit()

    got = await client.get("/api/todos", headers=_h(token), params={"date": "2026-08-03"})
    assert got.status_code == 200
    data = got.json()
    assert len(data) == 1
    card = data[0]
    assert card["goalId"] == goal_id
    assert card["goalTitle"] == "UI/UX 완주"
    assert card["date"] == "2026-08-03"
    assert [i["content"] for i in card["items"]] == ["UI/UX 21강 수강", "오답노트 정리"]
    assert card["items"][0]["tag"] == "강의"

    # 할 일 없는 날은 빈 목록
    empty = await client.get("/api/todos", headers=_h(token), params={"date": "2026-08-05"})
    assert empty.json() == []


async def test_todo_marks(client: AsyncClient, session_factory: async_sessionmaker):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        todo = await create_daily_todo(
            s,
            goal,
            date(2026, 8, 3),
            [{"content": "a"}, {"content": "b"}, {"content": "c"}],
        )
        # 2개 완료 → 꽃잎 2장 (goal_id 두 번)
        todo.items[0].is_done = True
        todo.items[1].is_done = True
        await s.commit()

    res = await client.get("/api/todos/marks", headers=_h(token), params={"month": "2026-08"})
    assert res.status_code == 200
    marks = res.json()["marks"]
    assert len(marks) == 1
    assert marks[0]["date"] == "2026-08-03"
    assert marks[0]["doneGoalIds"] == [goal_id, goal_id]


async def test_todo_marks_invalid_month(client: AsyncClient):
    token = await _token(client)
    res = await client.get("/api/todos/marks", headers=_h(token), params={"month": "2026/08"})
    assert res.status_code == 422
    assert res.json()["code"] == "INVALID_MONTH"


async def test_check_todo_updates_progress(
    client: AsyncClient, session_factory: async_sessionmaker
):
    token = await _token(client)
    goal_id = await _make_goal(client, token)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        set_progress(goal, total=50, unit="강")  # AI 가 total·unit 초기화
        todo = await create_daily_todo(
            s, goal, date(2026, 8, 3), [{"content": "22~24강", "progress_delta": 3}]
        )
        await s.commit()
        item_id = todo.items[0].id

    # 체크 → current += 3
    async with session_factory() as s:
        item = await s.get(TodoItem, item_id)
        await set_item_done(s, item, True)
        await s.commit()
    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        assert goal.progress["current"] == 3

    # 해제 → current -= 3
    async with session_factory() as s:
        item = await s.get(TodoItem, item_id)
        await set_item_done(s, item, False)
        await s.commit()
    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        assert goal.progress["current"] == 0


async def test_todos_isolated_by_user(client: AsyncClient, session_factory: async_sessionmaker):
    t1 = await _token(client, "u1@b.com")
    t2 = await _token(client, "u2@b.com")
    goal_id = await _make_goal(client, t1)

    async with session_factory() as s:
        goal = await s.get(Goal, goal_id)
        await create_daily_todo(s, goal, date(2026, 8, 3), [{"content": "a"}])
        await s.commit()

    # 다른 사용자는 그 투두가 안 보인다
    res = await client.get("/api/todos", headers=_h(t2), params={"date": "2026-08-03"})
    assert res.json() == []
