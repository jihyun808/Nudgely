"""대화 단계 판정.

"처음엔 목표를 파악해라" 를 프롬프트에 적어도 모델은 지금이 처음인지 모른다.
히스토리가 밀려나면 또 묻기도 한다. 서버가 데이터로 판단해 지시를 준다.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.ai.prompts import GoalState, build_chat_messages
from tests.helpers import create_goal, token_for


def _stage_text(state: GoalState | None) -> str:
    msgs = build_chat_messages(
        persona=None, user_prompt=None, goal_title="선형대수", history=[], state=state
    )
    staged = [
        m["content"] for m in msgs if isinstance(m["content"], str) and "단계:" in m["content"]
    ]
    return staged[0] if staged else ""


def test_new_goal_asks_to_set_it_up():
    """1단계 — 분량·기한을 모르면 목표 세우기부터."""
    text = _stage_text(GoalState())

    assert "1단계" in text
    assert "set_progress" in text
    assert "set_due_date" in text


def test_progress_done_asks_to_finish():
    """4단계 — 진도가 다 차면 완주할지 먼저 묻는다."""
    text = _stage_text(GoalState(has_progress=True, is_progress_done=True))

    assert "4단계" in text
    assert "complete_goal 을 부르지 마라" in text


def test_overdue_also_asks_to_finish():
    """기한이 지나도 4단계로 본다."""
    text = _stage_text(GoalState(has_progress=True, is_overdue=True))
    assert "4단계" in text


def test_empty_day_asks_what_to_do():
    """2단계 — 오늘 투두가 없으면 뭘 할지 묻는다."""
    text = _stage_text(GoalState(has_progress=True))

    assert "2단계" in text
    assert "create_todos" in text


def test_routine_is_offered_when_deciding_today():
    """정해 둔 반복 계획이 있으면 그걸 근거로 제안하게 한다."""
    text = _stage_text(GoalState(has_progress=True, routine_summary="수업(45분), 정리(15분)"))
    assert "수업(45분)" in text


def test_todo_without_plan_asks_for_time():
    """할 일은 있고 플래너가 비었으면 시간을 잡는다."""
    text = _stage_text(GoalState(has_progress=True, has_todo_today=True))

    assert "시간 잡기" in text
    assert "create_planner" in text


def test_nothing_to_nudge_stays_free():
    """규칙에 없는 상황이면 아무 지시도 넣지 않는다(자유 대화)."""
    settled = GoalState(has_progress=True, has_todo_today=True, has_plan_today=True)
    assert _stage_text(settled) == ""


def test_no_state_means_no_stage():
    assert _stage_text(None) == ""


@pytest.mark.parametrize(
    "state",
    [
        GoalState(),
        GoalState(has_progress=True),
        GoalState(has_progress=True, is_progress_done=True),
    ],
)
def test_stage_comes_after_goal_context(state: GoalState):
    """단계 지시는 목표 컨텍스트 뒤, 예시·히스토리 앞에 온다."""
    msgs = build_chat_messages(
        persona=None,
        user_prompt=None,
        goal_title="선형대수",
        history=[("user", "안녕")],
        state=state,
    )
    texts = [m["content"] if isinstance(m["content"], str) else "" for m in msgs]
    stage_at = next(i for i, t in enumerate(texts) if "단계:" in t)
    history_at = next(i for i, t in enumerate(texts) if t == "안녕")
    context_at = next(i for i, t in enumerate(texts) if "사용자의 현재 목표" in t)

    assert context_at < stage_at < history_at


# ── 서버가 상태를 모으는 부분 (_goal_state) ──


async def test_plan_check_is_per_goal(client: AsyncClient, session_factory: async_sessionmaker):
    """다른 목표에 시간을 잡아 뒀다고 이 목표까지 '계획 있음' 으로 보면 안 된다.

    플래너는 사용자당 하루 하나라서, 목표로 걸러내지 않으면
    두 번째 목표는 시간 잡기를 영영 건너뛴다.
    """
    from datetime import date as date_type

    from app.api.routes.goals import _goal_state
    from app.models.goal import Goal
    from app.services.planner_service import add_block

    token = await token_for(client, "stage@b.com")
    planned = await create_goal(client, token, name="선대냥이")
    other = await create_goal(client, token, name="크로키")
    today = date_type(2026, 9, 26)

    async with session_factory() as db:
        goal = await db.get(Goal, planned)
        await add_block(
            db,
            goal.user_id,
            today,
            title="1-1 수업",
            start_minutes=540,
            duration_minutes=45,
            goal_id=planned,
        )
        await db.commit()

    async with session_factory() as db:
        planned_state = await _goal_state(db, await db.get(Goal, planned), today)
        other_state = await _goal_state(db, await db.get(Goal, other), today)

    assert planned_state.has_plan_today is True
    assert other_state.has_plan_today is False, "다른 목표의 계획을 자기 것으로 봤다"


async def test_routine_summary_respects_weekdays(
    client: AsyncClient, session_factory: async_sessionmaker
):
    """오늘 하지 않는 요일의 항목은 제안 근거에서 빠져야 한다."""
    from datetime import date as date_type

    from app.api.routes.goals import _goal_state
    from app.models.goal import Goal
    from app.services.goal_service import set_progress, set_routine

    token = await token_for(client, "stage2@b.com")
    goal_id = await create_goal(client, token)
    saturday = date_type(2026, 9, 26)  # 토요일(weekday()==5)

    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        set_progress(goal, total=24, unit="소주제")
        await set_routine(
            db,
            goal,
            [
                {"content": "평일만", "weekdays": "01234"},
                {"content": "매일", "duration_minutes": 30},
            ],
        )
        await db.commit()

    async with session_factory() as db:
        state = await _goal_state(db, await db.get(Goal, goal_id), saturday)

    assert "매일(30분)" in state.routine_summary
    assert "평일만" not in state.routine_summary


def test_routine_todos_are_confirmed_before_anything_else():
    """서버가 미리 넣어 둔 것을 말없이 두면 사용자는 누가 넣었는지 모른다."""
    text = _stage_text(GoalState(has_progress=True, has_todo_today=True, todos_need_confirm=True))

    assert "미리 넣어 뒀다" in text
    assert "이대로 할지" in text


def test_todo_stage_asks_to_save_then_asks_the_time():
    """안내만 하고 넘어가면 기록 탭이 비어 있고, 시간도 안 잡힌다."""
    text = _stage_text(GoalState(has_progress=True))

    assert "투두에 남길까요" in text
    assert "몇 시에 할까요" in text
