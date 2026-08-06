"""홈 미리보기 스키마 (types/home.ts)."""

from datetime import datetime

from app.schemas.common import CamelModel


class HomePreviewOut(CamelModel):
    id: str
    kind: str  # message | notice | ad
    title: str
    subtitle: str | None = None
    content: str
    received_at: datetime
    link_to: str | None = None
