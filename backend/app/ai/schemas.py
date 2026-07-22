"""AI 관련 요청/응답 데이터 모델(스키마).

FastAPI 가 이 모델로 요청 본문을 검증하고 응답을 직렬화합니다.
"""

from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["system", "user", "assistant"]


class ChatMessage(BaseModel):
    """대화 한 턴."""

    role: Role
    content: str


class ChatRequest(BaseModel):
    """POST /api/ai/chat 요청 본문."""

    messages: list[ChatMessage] = Field(
        ...,
        min_length=1,
        description="대화 히스토리. 마지막이 사용자의 최신 메시지.",
    )


class ChatResponse(BaseModel):
    """POST /api/ai/chat 응답 본문."""

    reply: str
    model: str
