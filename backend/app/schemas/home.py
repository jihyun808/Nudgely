"""홈 미리보기 스키마 (types/home.ts)."""

from app.schemas.common import CamelModel, UtcDatetime


class HomePreviewOut(CamelModel):
    id: str
    kind: str  # message | notice | ad
    title: str
    subtitle: str | None = None
    content: str
    received_at: UtcDatetime
    link_to: str | None = None
