"""AI 도구(function calling) 정의 + 디스패처.

대화 중 AI가 호출하는 도구를 실제 서비스 동작으로 연결한다(ai-plan §4).
- 스키마 선언은 tool_schemas.py 에 있다(대화 요청에 함께 전달).
- dispatch_tool_call: 도구 호출 → DB 쓰기. 키 없이 단위 테스트 가능.

모든 쓰기는 이미 검증된 서비스 함수를 재사용한다:
  투두=record_service, 플래너=planner_service, 마일스톤·진도=progress/goal_service
"""

import logging
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.tool_schemas import TOOL_SCHEMAS
from app.models.goal import Goal
from app.models.todo import Todo, TodoItem
from app.services.goal_service import set_progress
from app.services.notification_service import RECORD_LINK, create_notification
from app.services.planner_service import add_block
from app.services.progress_service import set_milestones, sync_milestones
from app.services.record_service import add_todo_items, set_item_done

logger = logging.getLogger(__name__)

#: 스키마는 선언만 따로 두고 여기서 다시 내보낸다(호출부는 그대로)
__all__ = ["TOOL_SCHEMAS", "ToolArgError", "dispatch_tool_call"]

# OpenAI tools 스키마 (chat.completions 의 tools 인자로 전달)


# ── 인자 검증 ──────────────────────────────────────────────
#
# 모델이 보내는 인자는 신뢰할 수 없다. 실제로 create_todos 의 date 를
# 2023-10-01 로 찍어 화면에 영영 안 보이는 날짜에 저장된 적이 있다.
# 여기서 걸러 ToolArgError 를 던지면 대화를 끊지 않고 모델에게 사유를
# 돌려주어 고쳐서 다시 부르게 한다.

#: 한 번에 받을 수 있는 항목 수 상한(폭주 방지)
MAX_ITEMS = 30
#: 자정 기준 분. 24:00 == 1440
DAY_MINUTES = 24 * 60
MILESTONE_STATUSES = ("done", "current", "upcoming")


class ToolArgError(ValueError):
    """도구 인자가 잘못됐다. 메시지는 모델에게 그대로 전달된다."""


def _req_date(args: dict, key: str) -> date:
    raw = args.get(key)
    if not isinstance(raw, str):
        raise ToolArgError(f"{key} 는 'YYYY-MM-DD' 문자열이어야 한다.")
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise ToolArgError(
            f"{key}='{raw}' 는 날짜 형식이 아니다. 'YYYY-MM-DD' 로 보내라."
        ) from None


def _req_text(value: object, field: str, *, max_len: int = 200) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ToolArgError(f"{field} 는 비어 있지 않은 문자열이어야 한다.")
    text = value.strip()
    if len(text) > max_len:
        raise ToolArgError(f"{field} 가 너무 길다({len(text)}자). {max_len}자 이내로 줄여라.")
    return text


def _req_int(value: object, field: str, *, low: int, high: int, default: int | None = None) -> int:
    if value is None and default is not None:
        return default
    # bool 은 int 의 하위형이라 따로 막는다. True 가 1 로 새어 들어간다
    if isinstance(value, bool) or not isinstance(value, int):
        raise ToolArgError(f"{field} 는 정수여야 한다(받은 값: {value!r}).")
    if not low <= value <= high:
        raise ToolArgError(f"{field} 는 {low}~{high} 사이여야 한다(받은 값: {value}).")
    return value


def _req_items(args: dict, key: str, *, allow_empty: bool = False) -> list[dict]:
    raw = args.get(key)
    if not isinstance(raw, list):
        raise ToolArgError(f"{key} 는 배열이어야 한다.")
    if not raw and not allow_empty:
        raise ToolArgError(f"{key} 는 비어 있지 않은 배열이어야 한다.")
    if len(raw) > MAX_ITEMS:
        raise ToolArgError(f"{key} 가 너무 많다({len(raw)}개). 한 번에 {MAX_ITEMS}개까지만 보내라.")
    if not all(isinstance(item, dict) for item in raw):
        raise ToolArgError(f"{key} 의 각 항목은 객체여야 한다.")
    return raw


async def _dispatch(db: AsyncSession, goal: Goal, name: str, arguments: dict) -> str:
    """도구 호출을 실제 동작으로. 반환 문자열은 모델에 tool 결과로 다시 전달된다."""
    if name == "list_todos":
        on = _req_date(arguments, "date")
        todo = (
            await db.execute(select(Todo).where(Todo.goal_id == goal.id, Todo.date == on))
        ).scalar_one_or_none()
        if todo is None or not todo.items:
            return f"{on} 에 이 목표로 잡힌 투두가 없다."
        lines = [
            f"- itemId={i.id} | {i.content} | {'완료' if i.is_done else '미완료'}"
            + (f" | 진도 +{i.progress_delta}" if i.progress_delta else "")
            for i in todo.items
        ]
        return f"{on} 투두 {len(todo.items)}개:\n" + "\n".join(lines)

    if name == "create_todos":
        on = _req_date(arguments, "date")
        items = [
            {
                "content": _req_text(it.get("content"), "items[].content"),
                "tag": _req_text(it["tag"], "items[].tag", max_len=20) if it.get("tag") else None,
                "progress_delta": _req_int(
                    it.get("progressDelta"), "items[].progressDelta", low=0, high=1000, default=0
                ),
            }
            for it in _req_items(arguments, "items")
        ]
        _todo, created, skipped = await add_todo_items(db, goal, on, items)
        if not created:
            # 전부 이미 있는 것들이었다. 알림까지 보내면 사용자에게 두 번 알리게 된다
            await db.rollback()
            return (
                f"{on} 에 이미 같은 할 일이 있어 새로 만들지 않았다"
                f"({skipped}개 중복). list_todos 로 확인해라."
            )
        await create_notification(
            db,
            goal.user_id,
            ntype="todoAdded",
            title=goal.name,
            body=f"새 할 일 {len(created)}개가 추가됐어요.",
            # 투두 알림은 기록 탭으로 보낸다(features.md §4 — 독촉만 채팅방)
            link_to=RECORD_LINK,
        )
        await db.commit()
        made = ", ".join(f"itemId={i.id}({i.content})" for i in created)
        note = f" 이미 있어 건너뛴 것 {skipped}개." if skipped else ""
        return f"{on} 에 투두 {len(created)}개를 추가했다: {made}.{note}"

    if name == "check_todo_item":
        item = await db.get(TodoItem, _req_text(arguments.get("itemId"), "itemId", max_len=64))
        if item is None:
            return (
                "그 itemId 의 투두 항목이 없다. 지어내지 말고 list_todos 로 "
                "그날의 itemId 를 먼저 확인해라. 새로 만들지도 마라."
            )
        todo = await db.get(Todo, item.todo_id)
        if todo is None or todo.goal_id != goal.id:
            return "이 목표의 항목이 아니다."
        raw_done = arguments.get("done", True)
        if not isinstance(raw_done, bool):
            raise ToolArgError("done 은 true/false 여야 한다.")
        done = raw_done
        await set_item_done(db, item, done)
        if done:
            await create_notification(
                db,
                goal.user_id,
                ntype="todoDone",
                title=goal.name,
                body="할 일을 완료했어요!",
                link_to=RECORD_LINK,
            )
        await db.commit()
        return "투두 체크 상태를 갱신했다."

    if name == "create_planner":
        on = _req_date(arguments, "date")
        blocks = _req_items(arguments, "blocks")
        for b in blocks:
            start = _req_int(
                b.get("startMinutes"), "blocks[].startMinutes", low=0, high=DAY_MINUTES - 1
            )
            duration = _req_int(
                b.get("durationMinutes"), "blocks[].durationMinutes", low=1, high=DAY_MINUTES
            )
            if start + duration > DAY_MINUTES:
                raise ToolArgError(
                    f"blocks[] 가 자정을 넘는다(시작 {start}분 + {duration}분). "
                    "하루를 넘기려면 날짜별로 나눠서 보내라."
                )
            await add_block(
                db,
                goal.user_id,
                on,
                title=_req_text(b.get("title"), "blocks[].title"),
                start_minutes=start,
                duration_minutes=duration,
                # 계획은 그 목표의 채팅방에서 세우므로 목표가 분명하다
                goal_id=goal.id,
            )
        await db.commit()
        return f"{on} 플래너 계획 {len(blocks)}개를 세웠다."

    if name == "set_milestones":
        # target 은 진도 위의 지점이라 전체 분량을 넘을 수 없다.
        # 넘으면 그 단계가 영원히 끝나지 않는다.
        total = int((goal.progress or {}).get("total") or 0)
        ms = []
        for m in _req_items(arguments, "milestones", allow_empty=True):
            status = m.get("status", "upcoming")
            if status not in MILESTONE_STATUSES:
                raise ToolArgError(
                    f"milestones[].status 는 {'|'.join(MILESTONE_STATUSES)} 중 하나여야 한다"
                    f"(받은 값: {status!r})."
                )
            target = m.get("target")
            ms.append(
                {
                    "title": _req_text(m.get("title"), "milestones[].title"),
                    "status": status,
                    "target": None
                    if target is None
                    else _req_int(target, "milestones[].target", low=1, high=total or 100000),
                }
            )
        await set_milestones(db, goal, ms)
        await db.commit()
        return f"마일스톤 {len(ms)}개로 갱신했다."

    if name == "set_progress":
        current, total, unit = (arguments.get(k) for k in ("current", "total", "unit"))
        if current is None and total is None and unit is None:
            raise ToolArgError(
                "current·total·unit 중 최소 하나는 있어야 한다. "
                "바꿀 게 없으면 이 도구를 부르지 마라."
            )
        set_progress(
            goal,
            current=None if current is None else _req_int(current, "current", low=0, high=100000),
            # total 은 '전체 분량' 이라 0 이면 의미가 없고, 상한 검사도 무력해진다
            total=None if total is None else _req_int(total, "total", low=1, high=100000),
            unit=None if unit is None else _req_text(unit, "unit", max_len=10),
        )
        # 진도를 세우거나 고치면 로드맵 단계도 다시 맞춘다
        await sync_milestones(db, goal)
        await db.commit()
        return f"진도를 갱신했다: {goal.progress}."

    if name == "complete_goal":
        if goal.completed_at is not None:
            return "이미 완주한 목표다."
        goal.completed_at = datetime.now(UTC)
        await db.commit()
        return "목표를 완주로 기록했다. 사용자에게 축하를 전해라."

    return f"알 수 없는 도구: {name}"


async def dispatch_tool_call(db: AsyncSession, goal: Goal, name: str, arguments: dict) -> str:
    """도구 호출을 실제 동작으로. 반환 문자열은 모델에 tool 결과로 다시 전달된다.

    인자가 잘못됐거나 도중에 터져도 **예외를 밖으로 내보내지 않는다.**
    여기서 새어 나가면 라우터가 SSE error 로 감싸 대화 자체가 끊긴다.
    사유를 문자열로 돌려주면 모델이 고쳐서 다시 부르거나 사용자에게 설명할 수 있다.
    """
    try:
        return await _dispatch(db, goal, name, arguments)
    except ToolArgError as exc:
        await db.rollback()
        return f"도구 인자가 잘못됐다: {exc}"
    except Exception as exc:  # noqa: BLE001 - 도구 실패로 대화를 끊지 않는다
        await db.rollback()
        logger.exception("도구 실행 실패: %s(%r)", name, arguments)
        return (
            f"도구 실행에 실패했다({type(exc).__name__}). "
            "사용자에게 잠시 후 다시 시도하라고 알려라."
        )
