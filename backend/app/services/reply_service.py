"""AI 응답 생성 (채팅방).

응답 생성을 HTTP 요청에서 떼어낸다.

답이 오는 중에 채팅방을 나가면 SSE 연결이 끊긴다. 예전에는 그 순간
스트리밍 제너레이터가 취소돼 **응답이 통째로 사라졌다** — 저장이 맨 끝에
있었기 때문이다. 도구는 각자 바로 커밋하므로 "투두는 생겼는데 AI 말은
없는" 상태가 남았다.

지금은 생성이 백그라운드 태스크에서 끝까지 돌아 메시지를 저장하고,
SSE 는 그 결과를 중계하기만 한다. 나갔다 와도 답이 와 있다.
"""

import asyncio
import logging
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai.streaming import ReplyStreamer
from app.ai.tools import dispatch_tool_call
from app.core.ids import new_id
from app.models.goal import Goal, Message
from app.schemas.common import to_utc_iso

logger = logging.getLogger(__name__)

#: 끝날 때까지 태스크 참조를 잡아둔다.
#: asyncio 는 태스크를 약참조로만 들고 있어, 놓으면 GC 가 거둬가며 생성이 끊긴다.
_running: set[asyncio.Task] = set()

#: 중계할 이벤트 하나. (이벤트 이름, 데이터). None 이면 끝.
Event = tuple[str, dict] | None


async def _run(
    *,
    queue: "asyncio.Queue[Event]",
    session_factory: async_sessionmaker[AsyncSession],
    streamer: ReplyStreamer,
    goal_id: str,
    assistant_id: str,
    persona: str | None,
    user_prompt: str | None,
    goal_title: str | None,
    history: list[tuple[str, str]],
    today: date | None,
    goal_progress: dict | None,
    due_date: date | None,
) -> None:
    """응답을 끝까지 만들어 저장한다. 듣는 사람이 없어도 계속 돈다.

    요청 세션은 응답이 끝나면 닫히므로 자기 세션을 따로 연다.
    """
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        if goal is None:  # 생성 중에 목표가 지워진 경우
            await queue.put(None)
            return

        was_completed = goal.completed_at is not None  # 이번 턴 완주 감지용

        async def _dispatch(name: str, arguments: dict) -> str:
            # AI 도구 호출 → 실제 동작(투두·플래너·마일스톤·진도·완주 처리)
            return await dispatch_tool_call(db, goal, name, arguments)

        full = ""
        try:
            async for text in streamer.stream(
                persona=persona,
                user_prompt=user_prompt,
                goal_title=goal_title,
                history=history,
                dispatch=_dispatch,
                today=today,
                goal_progress=goal_progress,
                due_date=due_date,
            ):
                full += text
                await queue.put(("delta", {"text": text}))
        except Exception as exc:  # noqa: BLE001 - 외부 AI 오류를 error 이벤트로 감싼다
            logger.warning("AI 응답 실패(goal=%s): %s", goal_id, exc)
            await queue.put(("error", {"code": "AI_ERROR", "message": f"AI 응답 실패: {exc}"}))
            await queue.put(None)
            return

        # 빈 응답은 저장하지 않는다. 말풍선만 덩그러니 남는다
        if not full.strip():
            await queue.put(("error", {"code": "AI_EMPTY", "message": "AI 응답이 비어 있습니다."}))
            await queue.put(None)
            return

        message = Message(id=assistant_id, goal_id=goal_id, role="assistant", content=full)
        db.add(message)
        await db.commit()
        await db.refresh(message)

        done: dict = {
            "messageId": assistant_id,
            "createdAt": to_utc_iso(message.created_at),
        }
        # 이번 턴에 AI 가 완주 처리했으면 프론트 축하 연출 신호를 얹는다(api.md §3.2).
        if not was_completed and goal.completed_at is not None:
            done["goalCompleted"] = True

        await queue.put(("done", done))
        await queue.put(None)


def start_reply(
    *,
    session_factory: async_sessionmaker[AsyncSession],
    streamer: ReplyStreamer,
    goal_id: str,
    persona: str | None,
    user_prompt: str | None,
    goal_title: str | None,
    history: list[tuple[str, str]],
    today: date | None = None,
    goal_progress: dict | None = None,
    due_date: date | None = None,
) -> tuple[str, "asyncio.Queue[Event]"]:
    """응답 생성을 백그라운드로 시작한다. (assistant 메시지 id, 이벤트 큐) 를 돌려준다.

    큐는 상한이 없다. 듣는 사람이 나가도 생성 쪽이 막히지 않아야 하기 때문이다
    (응답 하나 분량이라 메모리도 문제되지 않는다).
    """
    assistant_id = new_id("m")
    queue: asyncio.Queue[Event] = asyncio.Queue()

    task = asyncio.create_task(
        _run(
            queue=queue,
            session_factory=session_factory,
            streamer=streamer,
            goal_id=goal_id,
            assistant_id=assistant_id,
            persona=persona,
            user_prompt=user_prompt,
            goal_title=goal_title,
            history=history,
            today=today,
            goal_progress=goal_progress,
            due_date=due_date,
        )
    )
    _running.add(task)
    task.add_done_callback(_running.discard)

    return assistant_id, queue
