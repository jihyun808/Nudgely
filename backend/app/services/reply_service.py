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
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai.attachments import AttachmentContent
from app.ai.prompts import GoalState
from app.ai.streaming import ReplyStreamer
from app.ai.text import strip_markdown
from app.ai.tools import dispatch_tool_call
from app.core.ids import new_id
from app.models.goal import Goal, Message
from app.schemas.common import to_utc_iso
from app.services.notification_service import notify_reply

logger = logging.getLogger(__name__)

#: 끝날 때까지 태스크 참조를 잡아둔다.
#: asyncio 는 태스크를 약참조로만 들고 있어, 놓으면 GC 가 거둬가며 생성이 끊긴다.
_running: set[asyncio.Task] = set()

#: 중계할 이벤트 하나. (이벤트 이름, 데이터). None 이면 끝.
Event = tuple[str, dict] | None


@dataclass
class Listener:
    """SSE 를 아직 듣고 있는 사람이 있는지.

    채팅방을 보고 있으면 답이 화면에 흐르니 푸시가 필요 없다. 나갔거나 앱을
    껐으면 답이 온 걸 알 길이 없어 푸시로 알려야 한다. 중계하는 쪽(SSE 라우트)이
    끊길 때 active 를 내리고, 생성 쪽이 저장 직전에 읽는다.
    """

    active: bool = True


#: 한 턴에 보낼 말풍선 수 상한. 넘치면 마지막 하나로 합친다.
#: 사람이 카톡 보내듯 나눠 보내는 게 목적인데, 열 개씩 쏟아지면 도배가 된다.
MAX_BUBBLES = 5


#: 한 번에 띄울 선택 버튼 수 상한. 넘치면 버튼 없이 글로만 남긴다.
MAX_QUICK_REPLIES = 4
#: 버튼에 들어갈 글자 수 상한. 길면 칩이 줄바꿈되며 읽기 어려워진다.
MAX_QUICK_REPLY_LENGTH = 20

#: 프롬프트가 약속한 선택지 표기. 마지막 줄에 "[선택: 추가해줘 / 아니]" 로 적는다.
_CHOICE_RE = re.compile(r"\n?\s*\[선택:\s*(?P<options>[^\]]+)\]\s*$")


def extract_quick_replies(text: str) -> tuple[str, list[str]]:
    """답변 끝의 선택지 표기를 떼어 (남은 글, 보기들) 로 돌려준다.

    화면은 보기들을 입력창 위 버튼으로 그린다. 표기를 그대로 두면 말풍선에
    대괄호가 보이므로 떼어낸다.

    모델이 형식을 안 지키거나 보기가 너무 많거나 길면 아무것도 떼지 않는다
    (버튼이 안 생기고 글은 그대로 보인다 — 조용히 내용을 잃지 않는다).
    """
    match = _CHOICE_RE.search(text)
    if match is None:
        return text, []

    options = [part.strip() for part in match.group("options").split("/")]
    options = [option for option in options if option]
    if not 2 <= len(options) <= MAX_QUICK_REPLIES:
        return text, []
    if any(len(option) > MAX_QUICK_REPLY_LENGTH for option in options):
        return text, []

    return text[: match.start()].rstrip(), options


def split_bubbles(text: str) -> list[str]:
    """답변을 말풍선 단위로 나눈다. 빈 줄이 경계다.

    프롬프트에서 '길어지면 빈 줄로 끊어라' 고 일러 두고, 여기서 그 약속대로 자른다.
    한 덩어리로 다 보내면 카톡에 논문이 오는 것처럼 보인다.
    """
    parts = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if len(parts) <= MAX_BUBBLES:
        return parts
    # 상한을 넘으면 남은 것을 마지막 말풍선에 몰아넣는다(내용을 버리지 않는다)
    return parts[: MAX_BUBBLES - 1] + ["\n\n".join(parts[MAX_BUBBLES - 1 :])]


async def _run(
    *,
    queue: "asyncio.Queue[Event]",
    listener: Listener,
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
    attachment: AttachmentContent | None,
    state: GoalState | None,
) -> None:
    """응답을 끝까지 만들어 저장한다. 듣는 사람이 없어도 계속 돈다.

    요청 세션은 응답이 끝나면 닫히므로 자기 세션을 따로 연다.

    무슨 일이 있어도 마지막에 끝 신호(None)를 보낸다. 안 보내면 SSE 를 중계하는
    쪽이 queue.get() 에서 영원히 기다리고, 태스크 예외는 아무도 보지 않는다.
    """
    try:
        await _generate(
            queue=queue,
            listener=listener,
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
            attachment=attachment,
            state=state,
        )
    except Exception as exc:  # noqa: BLE001 - 저장 실패로 대화를 멈춰 세우지 않는다
        logger.exception("응답 생성이 중단됐다(goal=%s)", goal_id)
        await queue.put(
            ("error", {"code": "AI_ERROR", "message": f"응답을 저장하지 못했습니다: {exc}"})
        )
    finally:
        await queue.put(None)


async def _generate(
    *,
    queue: "asyncio.Queue[Event]",
    listener: Listener,
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
    attachment: AttachmentContent | None,
    state: GoalState | None,
) -> None:
    """실제 생성. 끝 신호는 부르는 쪽(_run)이 책임진다."""
    async with session_factory() as db:
        goal = await db.get(Goal, goal_id)
        if goal is None:  # 생성 중에 목표가 지워진 경우
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
                attachment=attachment,
                state=state,
            ):
                full += text
                await queue.put(("delta", {"text": text}))
        except Exception as exc:  # noqa: BLE001 - 외부 AI 오류를 error 이벤트로 감싼다
            logger.warning("AI 응답 실패(goal=%s): %s", goal_id, exc)
            await queue.put(("error", {"code": "AI_ERROR", "message": f"AI 응답 실패: {exc}"}))
            return

        # 선택지 표기를 먼저 떼어낸 뒤 말풍선을 나눈다
        # (표기가 별도 말풍선으로 떨어지면 빈 말풍선이 생긴다)
        body, quick_replies = extract_quick_replies(strip_markdown(full))

        # 빈 응답은 저장하지 않는다. 말풍선만 덩그러니 남는다
        if not body.strip():
            await queue.put(("error", {"code": "AI_EMPTY", "message": "AI 응답이 비어 있습니다."}))
            return

        # 첫 말풍선은 message_start 로 이미 알린 id 를 쓴다
        bubbles = split_bubbles(body)
        now = datetime.now(UTC)
        saved: list[Message] = []
        for index, bubble in enumerate(bubbles):
            saved.append(
                Message(
                    id=assistant_id if index == 0 else new_id("m"),
                    goal_id=goal_id,
                    role="assistant",
                    content=bubble,
                    # 같은 순간에 만들면 (created_at, id) 정렬에서 순서가 섞인다.
                    # 1ms 씩 띄워 보낸 순서를 보존한다.
                    created_at=now + timedelta(milliseconds=index),
                )
            )
        db.add_all(saved)
        await db.commit()
        for message in saved:
            await db.refresh(message)

        # 답이 왔는데 아무도 안 보고 있으면 알 길이 없다(앱을 껐거나 방을 나갔다).
        # 채팅방을 보고 있으면 화면에 이미 흘렀으니 보내지 않는다 — 방금 읽은 말을
        # 다시 울리면 도배가 된다. 종 아이콘에는 쌓지 않는다(푸시만, api.md §5.3).
        if not listener.active:
            await notify_reply(db, goal, bubbles[0])

        done: dict = {
            "messages": [
                {
                    "messageId": m.id,
                    "content": m.content,
                    "createdAt": to_utc_iso(m.created_at),
                }
                for m in saved
            ],
        }
        if quick_replies:
            done["quickReplies"] = quick_replies
        # 이번 턴에 AI 가 완주 처리했으면 프론트 축하 연출 신호를 얹는다(api.md §3.2).
        if not was_completed and goal.completed_at is not None:
            done["goalCompleted"] = True

        await queue.put(("done", done))


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
    attachment: AttachmentContent | None = None,
    state: GoalState | None = None,
) -> tuple[str, "asyncio.Queue[Event]", Listener]:
    """응답 생성을 백그라운드로 시작한다.

    (assistant 메시지 id, 이벤트 큐, 청취 상태) 를 돌려준다. 중계하는 쪽은 연결이
    끊길 때 청취 상태를 내려야 한다 — 그래야 답을 푸시로 알릴지 판단할 수 있다.

    큐는 상한이 없다. 듣는 사람이 나가도 생성 쪽이 막히지 않아야 하기 때문이다
    (응답 하나 분량이라 메모리도 문제되지 않는다).
    """
    assistant_id = new_id("m")
    queue: asyncio.Queue[Event] = asyncio.Queue()
    listener = Listener()

    task = asyncio.create_task(
        _run(
            queue=queue,
            listener=listener,
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
            attachment=attachment,
            state=state,
        )
    )
    _running.add(task)
    task.add_done_callback(_running.discard)

    return assistant_id, queue, listener
