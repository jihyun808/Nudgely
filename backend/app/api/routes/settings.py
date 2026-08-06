"""앱 설정 엔드포인트 (api.md §7).

    GET   /api/settings   설정 조회
    PATCH /api/settings   설정 부분 수정 (바뀐 항목만)

알림 발송 판단(스케줄러)이 이 값을 참조한다.
linkedProviders 는 소셜 계정 연결 기능이 붙으면 채운다(현재 []).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User, UserSettings
from app.schemas.settings import AppSettings, UpdateSettingsIn

router = APIRouter()


async def _get_or_create(db: AsyncSession, user: User) -> UserSettings:
    """설정 행이 없으면(구 계정 등) 기본값으로 만들어 준다."""
    s = await db.get(UserSettings, user.id)
    if s is None:
        s = UserSettings.defaults(user.id)
        db.add(s)
        await db.commit()
        await db.refresh(s)
    return s


@router.get("/settings", response_model=AppSettings)
async def get_settings(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> AppSettings:
    s = await _get_or_create(db, user)
    return AppSettings.from_orm_settings(s)


@router.patch("/settings", response_model=AppSettings)
async def update_settings(
    body: UpdateSettingsIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AppSettings:
    s = await _get_or_create(db, user)
    body.apply_to(s)
    await db.commit()
    await db.refresh(s)
    return AppSettings.from_orm_settings(s)
