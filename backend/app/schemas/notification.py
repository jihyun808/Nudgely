"""알림 스키마 (types/notification.ts)."""

from app.schemas.common import CamelModel, UtcDatetime


class NotificationOut(CamelModel):
    id: str
    type: str
    title: str
    body: str
    created_at: UtcDatetime
    is_read: bool
    link_to: str | None = None
