"""대화 응답 스트리머.

라우터는 `get_reply_streamer` 의존성으로 스트리머를 주입받아 AI 응답을
토큰 단위로 받는다. 이렇게 분리하면:
- 실제 구현은 OpenAI 를 호출한다(도구 호출 → 텍스트 스트리밍).
- 테스트는 가짜 스트리머를 주입해 키 없이도 SSE·도구 흐름을 검증한다.

`dispatch`: 모델이 도구를 호출하면 (name, arguments) 로 불리는 콜백.
반환 문자열이 도구 결과로 모델에 다시 전달된다. None 이면 도구 없이 동작.
"""

import asyncio
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable
from datetime import date
from typing import TYPE_CHECKING, Protocol

from app.ai.prompts import build_chat_messages
from app.ai.tools import TOOL_SCHEMAS

if TYPE_CHECKING:
    from app.ai.attachments import AttachmentContent

logger = logging.getLogger(__name__)

Dispatch = Callable[[str, dict], Awaitable[str]]

# 도구 호출 루프 상한(무한 루프 방지)
MAX_TOOL_ROUNDS = 5

#: 도구 라운드 한 번에 허용하는 시간(초).
#: settings.openai_timeout 은 요청 하나 기준이라, 라운드가 5번 돌면 그만큼 곱절이 된다.
#: 사용자는 그 시간 내내 빈 화면을 본다.
TOOL_ROUND_TIMEOUT = 25

#: 도구 라운드 재시도 횟수. 일시적 오류(과부하·끊김)만 한 번 더 시도한다.
TOOL_ROUND_RETRIES = 1
RETRY_BACKOFF_SECONDS = 0.5


class ReplyStreamer(Protocol):
    """(persona, prompt, 목표, 히스토리)를 받아 응답 텍스트를 토큰 단위로 흘린다.

    도구를 쓸 수 있으면 dispatch 로 실제 동작을 수행한 뒤 최종 텍스트를 스트리밍한다.
    """

    def stream(
        self,
        *,
        persona: str | None,
        user_prompt: str | None,
        goal_title: str | None,
        history: Iterable[tuple[str, str]],
        dispatch: Dispatch | None = None,
        today: date | None = None,
        goal_progress: dict | None = None,
        due_date: date | None = None,
        attachment: "AttachmentContent | None" = None,
    ) -> AsyncIterator[str]: ...


class OpenAIReplyStreamer:
    """OpenAI 기반 실제 구현. 클라이언트는 첫 스트림 시점에 지연 생성한다.

    (지연 생성 덕분에 키가 없으면 요청 처리 중 명확한 에러가 나고,
    SSE error 이벤트로 감싸 프론트에 전달할 수 있다.)
    """

    async def stream(
        self,
        *,
        persona: str | None,
        user_prompt: str | None,
        goal_title: str | None,
        history: Iterable[tuple[str, str]],
        dispatch: Dispatch | None = None,
        today: date | None = None,
        goal_progress: dict | None = None,
        due_date: date | None = None,
        attachment: "AttachmentContent | None" = None,
    ) -> AsyncIterator[str]:
        import json

        from app.ai.client import get_openai_client
        from app.core.config import settings

        client = get_openai_client()
        model = settings.openai_chat_model
        messages = build_chat_messages(
            persona=persona,
            user_prompt=user_prompt,
            goal_title=goal_title,
            history=history,
            today=today,
            goal_progress=goal_progress,
            due_date=due_date,
            attachment=attachment,
        )

        # 1) 도구 호출 라운드: 모델이 도구를 요청하면 실행하고 결과를 다시 넣는다.
        if dispatch is not None:
            for round_index in range(MAX_TOOL_ROUNDS):
                msg = await _tool_round(client, model, messages)
                if msg is None:
                    # 도구 라운드가 끝내 실패했다. 도구 없이 답이라도 하게 둔다
                    break
                if not msg.tool_calls:
                    break

                messages.append(msg.model_dump(exclude_none=True))
                for tc in msg.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments or "{}")
                    except json.JSONDecodeError:
                        # 인자가 JSON 이 아니면 빈 dict 대신 사유를 알려 고쳐 부르게 한다
                        result = "도구 인자가 올바른 JSON 이 아니다. 다시 호출해라."
                    else:
                        result = await dispatch(tc.function.name, args)
                    messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})

                if round_index == MAX_TOOL_ROUNDS - 1:
                    # 상한에 걸려 멈춘 것을 모델에게 알린다. 안 그러면 도구가 덜 돈 채로
                    # 다 끝난 것처럼 답한다.
                    messages.append(
                        {
                            "role": "system",
                            "content": (
                                "도구 호출 한도에 도달했다. 더 호출하지 말고, "
                                "지금까지 한 일만으로 사용자에게 답해라."
                            ),
                        }
                    )

        # 2) 최종 사용자 응답을 스트리밍(도구 없이).
        started = time.monotonic()
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            # 스트리밍은 기본으로 사용량을 안 주므로 따로 요청한다(마지막 청크에 붙는다)
            stream_options={"include_usage": True},
        )
        usage = None
        async for chunk in stream:
            usage = getattr(chunk, "usage", None) or usage
            # 사용량만 담긴 마지막 청크는 choices 가 비어 있다
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
        log_usage("reply", model, started, usage)


def log_usage(kind: str, model: str, started: float, usage: object | None) -> None:
    """모델 호출 한 건의 비용·지연을 남긴다.

    토큰 수를 남겨야 어느 쪽이 돈을 쓰는지 보인다. 이 앱은 한 턴에 히스토리 40개와
    도구 스키마를 매번 실어 보내서 입력 토큰이 크고, 도구 라운드가 여러 번 돌면
    그만큼 곱절이 된다. 지연도 같이 남겨 라운드가 몇 초씩 먹는지 보이게 한다.
    """
    elapsed_ms = round((time.monotonic() - started) * 1000)
    prompt = getattr(usage, "prompt_tokens", None)
    completion = getattr(usage, "completion_tokens", None)
    logger.info(
        "ai_call kind=%s model=%s elapsed_ms=%d prompt_tokens=%s completion_tokens=%s",
        kind,
        model,
        elapsed_ms,
        prompt if prompt is not None else "-",
        completion if completion is not None else "-",
    )


async def _tool_round(client, model: str, messages: list) -> object | None:
    """도구 라운드 한 번. 실패하면 None (도구 없이 답을 이어가게 한다).

    일시적 오류(과부하·연결 끊김·타임아웃)만 한 번 더 시도한다.
    키가 틀렸거나 요청이 잘못된 경우는 다시 해도 같은 결과라 바로 포기한다.
    """
    from openai import APIConnectionError, APITimeoutError, InternalServerError, RateLimitError

    transient = (APIConnectionError, APITimeoutError, InternalServerError, RateLimitError)

    for attempt in range(TOOL_ROUND_RETRIES + 1):
        try:
            resp = await asyncio.wait_for(
                client.chat.completions.create(model=model, messages=messages, tools=TOOL_SCHEMAS),
                timeout=TOOL_ROUND_TIMEOUT,
            )
            return resp.choices[0].message
        except (*transient, TimeoutError) as exc:
            if attempt >= TOOL_ROUND_RETRIES:
                logger.warning("도구 라운드 포기(%s): %s", type(exc).__name__, exc)
                return None
            logger.info("도구 라운드 재시도(%s)", type(exc).__name__)
            await asyncio.sleep(RETRY_BACKOFF_SECONDS)
        except Exception:  # noqa: BLE001 - 도구를 못 써도 대화는 이어간다
            logger.exception("도구 라운드 실패")
            return None
    return None


def get_reply_streamer() -> ReplyStreamer:
    """FastAPI 의존성. 테스트에서 override 로 교체한다."""
    return OpenAIReplyStreamer()
