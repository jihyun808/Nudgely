"""OpenAI 클라이언트 관리.

AsyncOpenAI 클라이언트를 앱 전체에서 하나만 재사용합니다.
"""

from functools import lru_cache

from openai import AsyncOpenAI

from app.core.config import settings


@lru_cache
def get_openai_client() -> AsyncOpenAI:
    """AsyncOpenAI 싱글턴.

    API 키가 없으면 명확한 에러를 던져 설정 누락을 빨리 알아채도록 함.
    """
    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY 가 설정되지 않았습니다. backend/.env 를 확인하세요."
        )
    return AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=settings.openai_timeout,
    )
