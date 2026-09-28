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
from app.core.storage import image_max_bytes, is_our_url, save_upload
from app.models.user import User, released_email
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
            # 우리가 발급한 주소만 받는다. 아무 주소나 받으면 프로필 사진이
            # 남의 서버를 가리키고, 그 서버는 화면을 여는 사람의 IP 를 본다
            if not is_our_url(body.image_url):
                raise AppError(
                    "VALIDATION_ERROR", "이미지 주소가 올바르지 않습니다.", status_code=422
                )
            user.image_url = body.image_url

    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> Response:
    # 소프트 삭제: 기록은 남기고 로그인만 막는다.
    # ⚠️ 딸린 데이터(목표·대화·기록) 처리 정책은 미확정(api.md §8-7).
    user.deleted_at = datetime.now(UTC)
    # 이메일 자리를 비켜 준다. 안 그러면 마음을 바꿔 돌아와도 같은 주소로
    # 다시 가입할 수 없다("이미 사용 중인 이메일" 만 보고 영문을 모른 채 떠난다).
    user.email = released_email(user.id)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
