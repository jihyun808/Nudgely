"""대화 응답 스트리머.

라우터는 `get_reply_streamer` 의존성으로 스트리머를 주입받아 AI 응답을
토큰 단위로 받는다. 이렇게 분리하면:
- 실제 구현은 OpenAI 를 호출한다(도구 호출 → 텍스트 스트리밍).
- 테스트는 가짜 스트리머를 주입해 키 없이도 SSE·도구 흐름을 검증한다.

`dispatch`: 모델이 도구를 호출하면 (name, arguments) 로 불리는 콜백.
반환 문자열이 도구 결과로 모델에 다시 전달된다. None 이면 도구 없이 동작.
"""

from collections.abc import AsyncIterator, Awaitable, Callable, Iterable
from typing import Protocol

from app.ai.prompts import build_chat_messages
from app.ai.tools import TOOL_SCHEMAS

Dispatch = Callable[[str, dict], Awaitable[str]]

# 도구 호출 루프 상한(무한 루프 방지)
MAX_TOOL_ROUNDS = 5


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
    ) -> AsyncIterator[str]:
        import json

        from app.ai.client import get_openai_client
        from app.core.config import settings

        client = get_openai_client()
        model = settings.openai_model
        messages = build_chat_messages(
            persona=persona,
            user_prompt=user_prompt,
            goal_title=goal_title,
            history=history,
        )

        # 1) 도구 호출 라운드: 모델이 도구를 요청하면 실행하고 결과를 다시 넣는다.
        if dispatch is not None:
            for _ in range(MAX_TOOL_ROUNDS):
                resp = await client.chat.completions.create(
                    model=model, messages=messages, tools=TOOL_SCHEMAS
                )
                msg = resp.choices[0].message
                if not msg.tool_calls:
                    break
                messages.append(msg.model_dump(exclude_none=True))
                for tc in msg.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments or "{}")
                    except json.JSONDecodeError:
                        args = {}
                    result = await dispatch(tc.function.name, args)
                    messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})

        # 2) 최종 사용자 응답을 스트리밍(도구 없이).
        stream = await client.chat.completions.create(model=model, messages=messages, stream=True)
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


def get_reply_streamer() -> ReplyStreamer:
    """FastAPI 의존성. 테스트에서 override 로 교체한다."""
    return OpenAIReplyStreamer()
