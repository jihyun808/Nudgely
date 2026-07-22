"""모든 라우터를 모으는 곳.

새 기능 라우터를 추가하면 여기서 include 하세요.
"""

from fastapi import APIRouter

from app.api.routes import chat, health

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(chat.router, prefix="/ai", tags=["ai"])
