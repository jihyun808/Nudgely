"""AI 대화 엔드포인트.

- POST /api/ai/chat         : 한 번에 답변 받기 (JSON)
- POST /api/ai/chat/stream  : 토큰 단위 스트리밍 (Server-Sent Events)
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.ai.schemas import ChatRequest, ChatResponse
from app.ai.service import AIService
from app.core.config import settings

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        service = AIService()
        reply = await service.chat(request.messages)
    except RuntimeError as exc:
        # 설정 누락 등 (예: API 키 없음)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - 외부 API 오류를 502로 감싸 전달
        raise HTTPException(status_code=502, detail=f"AI 요청 실패: {exc}") from exc
    return ChatResponse(reply=reply, model=settings.openai_model)


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    service = AIService()

    async def event_generator():
        try:
            async for token in service.chat_stream(request.messages):
                # SSE 형식: "data: <내용>\n\n"
                yield f"data: {token}\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"event: error\ndata: {exc}\n\n"
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
