"""대화 응답 스트리머.

라우터는 `get_reply_streamer` 의존성으로 스트리머를 주입받아 AI 응답을
토큰 단위로 받는다. 이렇게 분리하면:
- 실제 구현은 OpenAI 를 호출한다.
- 테스트는 가짜 스트리머를 주입해 키 없이도 SSE 흐름을 검증한다.
"""

from collections.abc import AsyncIterator, Iterable
from typing import Protocol

from app.ai.prompts import build_chat_messages


class ReplyStreamer(Protocol):
    """(persona, prompt, 목표, 히스토리)를 받아 응답 텍스트를 토큰 단위로 흘린다."""

    def stream(
        self,
        *,
        persona: str | None,
        user_prompt: str | None,
        goal_title: str | None,
        history: Iterable[tuple[str, str]],
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
    ) -> AsyncIterator[str]:
        # 지연 import/생성: 키가 없을 때 모듈 로드 자체가 실패하지 않도록.
        from app.ai.client import get_openai_client
        from app.core.config import settings

        client = get_openai_client()
        messages = build_chat_messages(
            persona=persona,
            user_prompt=user_prompt,
            goal_title=goal_title,
            history=history,
        )
        stream = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


def get_reply_streamer() -> ReplyStreamer:
    """FastAPI 의존성. 테스트에서 override 로 교체한다."""
    return OpenAIReplyStreamer()
