"""프로필 엔드포인트 (api.md §7).

    GET    /api/me   내 프로필
    PATCH  /api/me   프로필 수정 (닉네임 · 사진)
    DELETE /api/me   회원 탈퇴 (204)

사진 업로드(multipart)는 파일 스토리지 슬라이스에서 붙인다.
지금은 JSON(imageUrl) 로만 받는다.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import AppError
from app.core.storage import image_max_bytes, save_upload
from app.models.user import User
from app.schemas.user import NICKNAME_MAX, NICKNAME_MIN, UpdateProfileIn, UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


def _validate_nickname(nickname: str) -> str:
    nickname = nickname.strip()
    if not (NICKNAME_MIN <= len(nickname) <= NICKNAME_MAX):
        raise AppError(
            "VALIDATION_ERROR",
            f"닉네임은 {NICKNAME_MIN}~{NICKNAME_MAX}자여야 합니다.",
            status_code=422,
        )
    return nickname


@router.patch("/me", response_model=UserOut)
async def update_me(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """프로필 수정. 사진은 multipart(image), 닉네임은 form/JSON 모두 받는다."""
    ctype = request.headers.get("content-type", "")
    if ctype.startswith("multipart/form-data"):
        form = await request.form()
        nickname = form.get("nickname")
        if nickname is not None:
            user.nickname = _validate_nickname(str(nickname))
        image = form.get("image")
        if image is not None and hasattr(image, "read"):
            saved = save_upload(
                await image.read(),
                image.filename,
                allowed_exts={"jpg", "jpeg", "png"},
                max_bytes=image_max_bytes(),
            )
            user.image_url = saved.url
    else:
        body = UpdateProfileIn.model_validate(await request.json())
        if body.nickname is not None:
            user.nickname = _validate_nickname(body.nickname)
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
