"""푸시 기기 등록 스키마 (api.md §5.3)."""

from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

#: FCM 토큰은 보통 150~200자다. 넉넉히 두되 무한정 받지는 않는다
TOKEN_MAX = 512


class RegisterDeviceIn(CamelModel):
    token: str = Field(min_length=10, max_length=TOKEN_MAX)
    platform: Literal["ios", "android", "web"]
