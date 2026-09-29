"""알림 스키마 (types/notification.ts)."""

from app.schemas.common import CamelModel, UtcDatetime


class NotificationOut(CamelModel):
    id: str
    type: str
    title: str
    body: str
    created_at: UtcDatetime
    is_read: bool
    # 어느 목표에서 난 일인지. 앱 안 목록에서 그 방으로 가는 데 쓴다.
    # (푸시는 이동하지 않는다 — 앱이 열리는 것까지가 역할이다)
    goal_id: str | None = None
