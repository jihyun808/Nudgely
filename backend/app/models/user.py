"""사용자 · 설정 모델.

- User: 계정 기본 정보
- UserSettings: 알림·방해금지·플래너 설정 (User 와 1:1)

설정을 별도 테이블로 둔 이유: 알림 발송 판단(스케줄러)이 이 값을 자주 읽고,
프론트 /settings 응답 구조(api.md §7)와 그대로 매핑하기 위해서다.
"""

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.ids import new_id


def _now() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("u"))
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    nickname: Mapped[str | None] = mapped_column(String, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    # 회원 탈퇴 시각. NULL 이면 활성 계정. (탈퇴 데이터 처리 정책은 미확정, api.md §8-7)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    settings: Mapped["UserSettings"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    # 알림 (notifications.enabled 가 꺼지면 하위 항목은 모두 무시)
    notif_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    notif_nudge: Mapped[bool] = mapped_column(Boolean, default=True)
    notif_todo: Mapped[bool] = mapped_column(Boolean, default=True)
    notif_deadline: Mapped[bool] = mapped_column(Boolean, default=True)

    # 방해 금지 시간대 (start > end 면 자정을 넘긴 것으로 해석)
    dnd_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    dnd_start_hour: Mapped[int] = mapped_column(Integer, default=0)
    dnd_end_hour: Mapped[int] = mapped_column(Integer, default=7)

    # 텐미닛 플래너 표시 범위
    planner_start_hour: Mapped[int] = mapped_column(Integer, default=6)
    planner_end_hour: Mapped[int] = mapped_column(Integer, default=24)

    user: Mapped["User"] = relationship(back_populates="settings")

    @classmethod
    def defaults(cls, user_id: str) -> "UserSettings":
        """가입 시 기본 설정 한 벌을 만든다.

        컬럼 default 는 DB 삽입 시점에만 적용되므로, transient 객체도
        바로 쓸 수 있도록 값을 명시적으로 채운다.
        """
        return cls(
            user_id=user_id,
            notif_enabled=True,
            notif_nudge=True,
            notif_todo=True,
            notif_deadline=True,
            dnd_enabled=False,
            dnd_start_hour=0,
            dnd_end_hour=7,
            planner_start_hour=6,
            planner_end_hour=24,
        )
