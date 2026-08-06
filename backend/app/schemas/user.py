"""사용자 관련 스키마."""

from pydantic import Field

from app.schemas.common import CamelModel

# 프론트 검증 규칙(api.md §2, features.md §3): 닉네임 1~10자
NICKNAME_MIN = 1
NICKNAME_MAX = 10


class UserOut(CamelModel):
    """프론트 User 타입과 1:1 (types/auth.ts)."""

    id: str
    email: str
    nickname: str | None = None
    image_url: str | None = None


class UpdateProfileIn(CamelModel):
    """PATCH /me. 보낸 필드만 갱신한다."""

    nickname: str | None = Field(default=None, min_length=NICKNAME_MIN, max_length=NICKNAME_MAX)
    image_url: str | None = None
