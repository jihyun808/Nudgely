"""공통 스키마 베이스.

프론트는 모든 필드를 camelCase 로 주고받는다(imageUrl, accessToken ...).
파이썬은 snake_case 를 쓰므로, 별칭 생성기로 자동 변환한다.

- 응답: FastAPI 가 기본으로 alias(camelCase)로 직렬화한다.
- 요청: populate_by_name=True 라서 camelCase/ snake_case 둘 다 받는다.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,  # ORM 객체에서 바로 검증 가능
    )
