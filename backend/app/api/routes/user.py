"""프로필 엔드포인트 (api.md §7).

    GET    /api/me   내 프로필
    PATCH  /api/me   프로필 수정 (닉네임 · 사진)
    DELETE /api/me   회원 탈퇴 (204)

사진 업로드(multipart)는 파일 스토리지 슬라이스에서 붙인다.
지금은 JSON(imageUrl) 로만 받는다.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.user import UpdateProfileIn, UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UpdateProfileIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    if body.nickname is not None:
        user.nickname = body.nickname.strip()
    if body.image_url is not None:
        user.image_url = body.image_url
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> Response:
    # 소프트 삭제: deleted_at 만 채운다.
    # ⚠️ 딸린 데이터(목표·대화·기록) 처리 정책은 미확정(api.md §8-7).
    user.deleted_at = datetime.now(UTC)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
