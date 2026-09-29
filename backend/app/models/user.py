"""사용자 · 설정 모델.

- User: 계정 기본 정보
- UserSettings: 알림·방해금지·플래너 설정 (User 와 1:1)

설정을 별도 테이블로 둔 이유: 알림 발송 판단(스케줄러)이 이 값을 자주 읽고,
프론트 /settings 응답 구조(api.md §7)와 그대로 매핑하기 위해서다.
"""

from datetime import UTC, datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, UtcDateTime
from app.core.ids import new_id
from app.core.timezones import DEFAULT_TIMEZONE


def _now() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("u"))
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    nickname: Mapped[str | None] = mapped_column(String, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)
    # 회원 탈퇴 시각. NULL 이면 활성 계정. (탈퇴 데이터 처리 정책은 미확정, api.md §8-7)
    deleted_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)

    # 발급해 둔 토큰을 한 번에 무효로 만드는 번호. 토큰에 함께 담기고,
    # 여기 값과 다르면 거절한다(app/api/deps.py).
    #
    # 무상태 JWT 라 로그아웃만으로는 토큰이 죽지 않는다 — 기기를 잃어버렸을 때
    # 끊을 방법이 있어야 해서 둔다. 비밀번호를 바꾸면 올라가고,
    # 그 순간 모든 기기가 로그아웃된다(다른 기기를 정리하는 방법이기도 하다).
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── 가입 시 동의 기록 (이용약관 §4) ──
    # "동의를 받았다" 를 나중에 입증하려면 시각이 남아야 한다. 불리언만으로는 부족하다.
    # 약관을 개정하면 재동의를 받아야 하므로 어느 버전에 동의했는지도 함께 남긴다.
    # ⚠️ 가입 화면에 동의 UI 가 붙기 전까지는 비어 있을 수 있어 전부 nullable 이다.
    terms_agreed_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    privacy_agreed_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    terms_version: Mapped[str | None] = mapped_column(String, nullable=True)
    # 만 14세 이상임을 확인한 시각. 개인정보 보호법 §22조의2 대응
    age_confirmed_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    # 광고성 정보 수신 동의(선택). 정보통신망법상 사전 동의가 필요하다
    marketing_agreed_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)

    settings: Mapped["UserSettings"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )


#: 탈퇴한 계정이 비켜 주는 자리. email 은 unique 라, 주소를 그대로 두면
#: 그 사람이 마음을 바꿔 돌아와도 "이미 사용 중인 이메일" 에 막힌다.
#: .invalid 는 예약된 TLD(RFC 2606)라 실제 주소와 절대 겹치지 않는다.
def released_email(user_id: str) -> str:
    return f"deleted+{user_id}@nudgely.invalid"


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

    # IANA 타임존. 밤 11시 점검·방해금지·"오늘 집중 시간" 이 전부 이 값 기준이다.
    # api.md 에는 없는 필드 — 프론트가 안 보내면 기본값을 쓴다.
    timezone: Mapped[str] = mapped_column(String, default=DEFAULT_TIMEZONE)

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
            timezone=DEFAULT_TIMEZONE,
        )
