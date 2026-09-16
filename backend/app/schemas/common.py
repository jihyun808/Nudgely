"""공통 스키마 베이스.

프론트는 모든 필드를 camelCase 로 주고받는다(imageUrl, accessToken ...).
파이썬은 snake_case 를 쓰므로, 별칭 생성기로 자동 변환한다.

- 응답: FastAPI 가 기본으로 alias(camelCase)로 직렬화한다.
- 요청: populate_by_name=True 라서 camelCase/ snake_case 둘 다 받는다.

시각을 내려줄 땐 `datetime` 대신 `UtcDatetime` 을 쓴다 (아래 설명).
"""

from datetime import UTC, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel


def to_utc_iso(value: datetime) -> str:
    """항상 `2026-08-03T04:12:00Z` 꼴로 내보낸다 (api.md §1: ISO 8601 UTC).

    SQLite 는 타임존을 저장하지 않아 naive datetime 이 돌아온다.
    표시가 없으면 프론트의 `new Date(...)` 가 **로컬 시각으로** 읽어버려
    한국에서는 9시간이 어긋난다. 저장값이 UTC 라는 사실을 표기로 명시한다.
    """
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


# 응답에 쓰는 시각 타입. 요청 스키마에는 쓰지 않는다(들어오는 값은 그대로 파싱).
UtcDatetime = Annotated[datetime, PlainSerializer(to_utc_iso, return_type=str)]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,  # ORM 객체에서 바로 검증 가능
    )
