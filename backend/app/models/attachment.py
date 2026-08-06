"""첨부 모델 (api.md §3.6 모아보기).

채팅에서 주고받은 파일/사진. 동영상은 받지 않는다.
- kind: file(문서) | image(사진)
- message_id: 어느 메시지에 붙었는지(선택)
- thumb_url: 사진 목록·말풍선 썸네일용(이미지에만)
"""

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.ids import new_id


def _now() -> datetime:
    return datetime.now(UTC)


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("a"))
    goal_id: Mapped[str] = mapped_column(
        String, ForeignKey("goals.id", ondelete="CASCADE"), index=True
    )
    message_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("messages.id", ondelete="CASCADE"), nullable=True, index=True
    )
    kind: Mapped[str] = mapped_column(String, nullable=False)  # file | image
    name: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    url: Mapped[str] = mapped_column(String, nullable=False)
    thumb_url: Mapped[str | None] = mapped_column(String, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
