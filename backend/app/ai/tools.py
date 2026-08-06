"""AI 도구(function calling) 정의 + 디스패처.

대화 중 AI가 호출하는 도구를 실제 서비스 동작으로 연결한다(ai-plan §4).
- 스키마(TOOL_SCHEMAS): OpenAI tools 형식. 대화 요청에 함께 전달.
- dispatch_tool_call: 도구 호출 → DB 쓰기. 키 없이 단위 테스트 가능.

모든 쓰기는 이미 검증된 서비스 함수를 재사용한다:
  투두=record_service, 플래너=planner_service, 마일스톤·진도=progress/goal_service
"""

from datetime import UTC, date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.models.todo import Todo, TodoItem
from app.services.goal_service import set_progress
from app.services.notification_service import chat_link, create_notification
from app.services.planner_service import add_block
from app.services.progress_service import set_milestones
from app.services.record_service import add_todo_items, set_item_done

# OpenAI tools 스키마 (chat.completions 의 tools 인자로 전달)
TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "create_todos",
            "description": (
                "특정 날짜에 이 목표의 투두(할 일)를 추가한다. "
                "진도로 세는 항목은 progressDelta 를 준다(예: '3강 수강'→3). 복습·정리 등은 0."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "content": {"type": "string"},
                                "tag": {"type": "string", "description": "예: 강의, 복습"},
                                "progressDelta": {"type": "integer", "default": 0},
                            },
                            "required": ["content"],
                        },
                    },
                },
                "required": ["date", "items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_todo_item",
            "description": (
                "투두 항목의 완료 여부를 바꾼다. "
                "완료하면 목표 진도(current)가 항목의 progressDelta 만큼 자동 반영된다."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "itemId": {"type": "string"},
                    "done": {"type": "boolean", "default": True},
                },
                "required": ["itemId"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_planner",
            "description": (
                "특정 날짜의 텐미닛 플래너 '계획'을 세운다. 시간은 자정 기준 분(08:00→480)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "blocks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "startMinutes": {"type": "integer"},
                                "durationMinutes": {"type": "integer"},
                            },
                            "required": ["title", "startMinutes", "durationMinutes"],
                        },
                    },
                },
                "required": ["date", "blocks"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_milestones",
            "description": (
                "목표의 진도 마일스톤(로드맵)을 통째로 교체한다. status: done|current|upcoming."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "milestones": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "status": {
                                    "type": "string",
                                    "enum": ["done", "current", "upcoming"],
                                },
                            },
                            "required": ["title"],
                        },
                    }
                },
                "required": ["milestones"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "complete_goal",
            "description": (
                "사용자가 목표 완주를 확인하면 완료 처리한다. "
                "반드시 사용자의 명시적 확인('응 완주로 해줘' 등) 뒤에만 호출할 것."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_progress",
            "description": (
                "목표 진도를 절대값으로 설정/보정한다. 목표 파악 시 total·unit 을 세우고, "
                "사용자가 '30강까지 했어'처럼 말하면 current 를 교정한다. "
                "큰 변경은 먼저 대화로 확인할 것."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "current": {"type": "integer"},
                    "total": {"type": "integer"},
                    "unit": {"type": "string", "description": "예: 강, 페이지, 회차"},
                },
            },
        },
    },
]


async def dispatch_tool_call(db: AsyncSession, goal: Goal, name: str, arguments: dict) -> str:
    """도구 호출을 실제 동작으로. 반환 문자열은 모델에 tool 결과로 다시 전달된다."""
    if name == "create_todos":
        on = date.fromisoformat(arguments["date"])
        items = [
            {
                "content": it["content"],
                "tag": it.get("tag"),
                "progress_delta": int(it.get("progressDelta", 0)),
            }
            for it in arguments.get("items", [])
        ]
        await add_todo_items(db, goal, on, items)
        await create_notification(
            db,
            goal.user_id,
            ntype="todoAdded",
            title=goal.name,
            body=f"새 할 일 {len(items)}개가 추가됐어요.",
            link_to=chat_link(goal.id),
        )
        await db.commit()
        return f"{on} 에 투두 {len(items)}개를 추가했다."

    if name == "check_todo_item":
        item = await db.get(TodoItem, arguments["itemId"])
        if item is None:
            return "해당 투두 항목을 찾을 수 없다."
        todo = await db.get(Todo, item.todo_id)
        if todo is None or todo.goal_id != goal.id:
            return "이 목표의 항목이 아니다."
        done = bool(arguments.get("done", True))
        await set_item_done(db, item, done)
        if done:
            await create_notification(
                db,
                goal.user_id,
                ntype="todoDone",
                title=goal.name,
                body="할 일을 완료했어요!",
                link_to=chat_link(goal.id),
            )
        await db.commit()
        return "투두 체크 상태를 갱신했다."

    if name == "create_planner":
        on = date.fromisoformat(arguments["date"])
        blocks = arguments.get("blocks", [])
        for b in blocks:
            await add_block(
                db,
                goal.user_id,
                on,
                title=b["title"],
                start_minutes=int(b["startMinutes"]),
                duration_minutes=int(b["durationMinutes"]),
            )
        await db.commit()
        return f"{on} 플래너 계획 {len(blocks)}개를 세웠다."

    if name == "set_milestones":
        ms = [
            {"title": m["title"], "status": m.get("status", "upcoming")}
            for m in arguments.get("milestones", [])
        ]
        await set_milestones(db, goal, ms)
        await db.commit()
        return f"마일스톤 {len(ms)}개로 갱신했다."

    if name == "set_progress":
        set_progress(
            goal,
            current=arguments.get("current"),
            total=arguments.get("total"),
            unit=arguments.get("unit"),
        )
        await db.commit()
        return f"진도를 갱신했다: {goal.progress}."

    if name == "complete_goal":
        if goal.completed_at is not None:
            return "이미 완주한 목표다."
        goal.completed_at = datetime.now(UTC)
        await db.commit()
        return "목표를 완주로 기록했다. 사용자에게 축하를 전해라."

    return f"알 수 없는 도구: {name}"
