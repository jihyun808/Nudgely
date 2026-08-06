"""홈 · 알림 엔드포인트 (api.md §5).

    GET  /api/home/previews     안 읽은 메시지 미리보기 (목표당 한 장)
    GET  /api/notifications     알림 목록 (최신순, 최대 5)
    POST /api/notifications/read 전체 읽음 처리 (204)

밤 11시·독촉(nudge) 스케줄러는 다음 슬라이스.
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.home import HomePreviewOut
from app.schemas.notification import NotificationOut
from app.services.home_service import home_previews
from app.services.notification_service import list_notifications, mark_all_read

router = APIRouter()


@router.get("/home/previews", response_model=list[HomePreviewOut])
async def get_previews(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[HomePreviewOut]:
    return await home_previews(db, user.id)


@router.get("/notifications", response_model=list[NotificationOut])
async def get_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationOut]:
    return await list_notifications(db, user.id)


@router.post("/notifications/read", status_code=status.HTTP_204_NO_CONTENT)
async def read_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await mark_all_read(db, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
