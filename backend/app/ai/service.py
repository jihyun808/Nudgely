"""AI 서비스 레이어.

라우터(HTTP)와 OpenAI(외부 API) 사이의 비즈니스 로직을 담당합니다.
라우터는 이 서비스만 호출하고, OpenAI 세부사항은 여기서 캡슐화합니다.

현재는 기본 대화(chat)만 구현되어 있고, MVP 4대 기능은
이후 구체화할 수 있도록 자리를 잡아두었습니다.
"""

from collections.abc import AsyncIterator

from app.ai.client import get_openai_client
from app.ai.prompts import STUDY_PERSONA_SYSTEM_PROMPT
from app.ai.schemas import ChatMessage
from app.core.config import settings


class AIService:
    def __init__(self) -> None:
        self._client = get_openai_client()
        self._model = settings.openai_model

    def _build_messages(self, messages: list[ChatMessage]) -> list[dict[str, str]]:
        """페르소나 system 프롬프트를 맨 앞에 붙여 OpenAI 형식으로 변환."""
        history = [{"role": m.role, "content": m.content} for m in messages]
        return [{"role": "system", "content": STUDY_PERSONA_SYSTEM_PROMPT}, *history]

    async def chat(self, messages: list[ChatMessage]) -> str:
        """대화 히스토리를 받아 AI의 답변 한 개를 반환."""
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=self._build_messages(messages),
        )
        return response.choices[0].message.content or ""

    async def chat_stream(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        """답변을 토큰 단위로 스트리밍(타이핑 효과)."""
        stream = await self._client.chat.completions.create(
            model=self._model,
            messages=self._build_messages(messages),
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    # ── MVP 기능 자리(placeholder) ───────────────────────────
    # 내일 회의에서 입력/출력 스펙을 확정한 뒤 구현 예정.
    #
    # async def create_study_plan(self, ...): ...   # 학습 계획 세우기
    # async def generate_quiz(self, ...): ...       # 퀴즈 내기
    # async def create_todos(self, ...): ...        # to-do 만들기
    # async def review_helper(self, ...): ...       # 예습/복습 돕기
