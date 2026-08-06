"""목표(=채팅방) · 메시지 · 읽음 상태 모델.

핵심: 목표(Goal) 하나가 곧 채팅방이다. 홈의 목표 카드, 기록의 투두,
모아보기가 모두 같은 goal id 를 다른 각도로 보여준다.
"""

from datetime import UTC, date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.ids import new_id


def _now() -> datetime:
    return datetime.now(UTC)


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("g"))
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # 이름 두 종류: name=채팅방 별명(≤10), title=목표 이름(≤50)
    name: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # 사용자 커스텀 프롬프트(주입 방어 위해 시스템 프롬프트와 분리해 사용)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    persona: Mapped[str | None] = mapped_column(String, nullable=True)  # teacher|instructor|friend

    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    is_notification_muted: Mapped[bool] = mapped_column(Boolean, default=False)

    # 진도. 스키마 미확정이라 유연하게 JSON 으로 둔다: {current, total, unit}
    # (api.md §3.1 — AI 가 받을 정보와 함께 확정 예정)
    progress: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    messages: Mapped[list["Message"]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("m"))
    goal_id: Mapped[str] = mapped_column(
        String, ForeignKey("goals.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String, nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)

    goal: Mapped["Goal"] = relationship(back_populates="messages")


class ReadState(Base):
    """사용자가 각 목표에서 마지막으로 읽은 메시지. 안 읽은 개수 계산의 기준."""

    __tablename__ = "read_states"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    goal_id: Mapped[str] = mapped_column(
        String, ForeignKey("goals.id", ondelete="CASCADE"), primary_key=True
    )
    last_read_message_id: Mapped[str | None] = mapped_column(String, nullable=True)
