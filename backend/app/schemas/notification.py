"""알림 스키마 (types/notification.ts)."""

from datetime import datetime

from app.schemas.common import CamelModel


class NotificationOut(CamelModel):
    id: str
    type: str
    title: str
    body: str
    created_at: datetime
    is_read: bool
    link_to: str | None = None
