"""헬스체크 엔드포인트. 서버/설정이 살아있는지 확인용."""

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "env": settings.app_env,
        "model": settings.openai_model,
        # 키가 실제로 노출되지 않도록 존재 여부만 반환
        "openai_key_configured": bool(settings.openai_api_key),
    }
