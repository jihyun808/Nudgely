"""목표(=채팅방) · 메시지 · 읽음 상태 모델.

핵심: 목표(Goal) 하나가 곧 채팅방이다. 홈의 목표 카드, 기록의 투두,
모아보기가 모두 같은 goal id 를 다른 각도로 보여준다.
"""

from datetime import UTC, date, datetime

from sqlalchemy import JSON, Boolean, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, UtcDateTime
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
    # 이 방에서 AI 가 기억할 것(줄글). 사용자는 설정에서, AI 는 remember/forget 도구로 고친다.
    # prompt(말투·역할 지시)와 따로 둔다 — 기억은 지시가 아니라 사실이다.
    memory: Mapped[str | None] = mapped_column(Text, nullable=True)
    persona: Mapped[str | None] = mapped_column(String, nullable=True)  # teacher|instructor|friend

    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(UtcDateTime, default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)

    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    is_notification_muted: Mapped[bool] = mapped_column(Boolean, default=False)

    # "오늘은 그만 보내" 임시 스누즈. 이 시각(UTC) 전까지 선톡(nudge)을 멈춘다.
    # is_notification_muted(영구 끔)와 달리 하루가 지나면 자동으로 풀린다.
    nudge_snoozed_until: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)

    # 진도. 스키마 미확정이라 유연하게 JSON 으로 둔다: {current, total, unit}
    # (api.md §3.1 — AI 가 받을 정보와 함께 확정 예정)
    progress: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)

    messages: Mapped[list["Message"]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Message(Base):
    __tablename__ = "messages"
    # 같은 채팅방에서 한 client_id 는 한 번만. 재시도가 같은 키로 와도 두 번 저장되지 않는다.
    # (assistant 메시지와 과거 데이터는 NULL 이고, NULL 은 유니크 제약에 걸리지 않는다.)
    __table_args__ = (UniqueConstraint("goal_id", "client_id", name="uq_messages_goal_client"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("m"))
    goal_id: Mapped[str] = mapped_column(
        String, ForeignKey("goals.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String, nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    client_id: Mapped[str | None] = mapped_column(String, nullable=True)
    # 이 답을 만들며 실제로 실행한 도구와 결과(assistant 마지막 말풍선에만). 화면에는 안 보이고
    # 다음 턴 AI 에게만 넘긴다. 없으면 AI 는 자기가 한 '말' 만 보고 저장됐다고 믿는다.
    tool_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now, index=True)

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
