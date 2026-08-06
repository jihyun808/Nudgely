"""모든 라우터를 모으는 곳.

새 기능 라우터를 추가하면 여기서 include 하세요.
"""

from fastapi import APIRouter

from app.api.routes import auth, chat, focus, goals, health, records, settings, user

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(user.router, tags=["user"])
api_router.include_router(settings.router, tags=["settings"])
api_router.include_router(goals.router, tags=["goals"])
api_router.include_router(records.router, tags=["records"])
api_router.include_router(focus.router, tags=["focus"])
api_router.include_router(chat.router, prefix="/ai", tags=["ai"])
