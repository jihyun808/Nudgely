"""알림 모델 (api.md §5.2).

type: nudge | todoAdded | todoDone | todoIncomplete | plannerIncomplete
- nudge/todoAdded/todoDone → 해당 채팅방으로 이동
- todoIncomplete/plannerIncomplete → 기록 탭으로 이동

link_to: 프론트가 바로 이동할 경로 문자열(예: /chat/g_01H, /record).
(경로 조립을 서버가 하는 방식 — 프론트 AppNotification.linkTo 계약에 맞춤)
"""

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.ids import new_id

NOTIFICATION_TYPES = (
    "nudge",
    "todoAdded",
    "todoDone",
    "todoIncomplete",
    "plannerIncomplete",
)


def _now() -> datetime:
    return datetime.now(UTC)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("n"))
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    link_to: Mapped[str | None] = mapped_column(String, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
