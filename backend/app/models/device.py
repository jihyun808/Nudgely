"""푸시를 받을 기기 (api.md §5.3).

FCM 은 '기기' 가 아니라 **등록 토큰** 으로 보낸다. 토큰은 앱이 켜질 때 FCM SDK 가
발급하고, 앱 재설치·데이터 삭제·오랜 미사용으로 조용히 바뀐다. 그래서:

- 토큰 자체가 기본키다. 같은 기기에서 다른 계정으로 로그인하면 user_id 만 바뀌고,
  이전 사용자에게 가던 푸시가 따라가지 않는다(남의 알림이 뜨는 사고를 막는다).
- 죽은 토큰은 보내다가 알게 된다. FCM 이 UNREGISTERED 를 주면 그 자리에서 지운다
  (push_service). 안 지우면 탈퇴한 기기에 영원히 보낸다.
"""

from datetime import UTC, datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UtcDateTime

#: 프론트가 보내는 값 (Capacitor: ios | android, 웹 푸시: web)
DEVICE_PLATFORMS = ("ios", "android", "web")


def _now() -> datetime:
    return datetime.now(UTC)


class DeviceToken(Base):
    __tablename__ = "device_tokens"

    #: FCM 등록 토큰. 기기마다 하나이고 앱이 재발급하면 새 행이 된다.
    token: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    platform: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)
    #: 마지막으로 등록을 확인한 시각. 앱을 켤 때마다 갱신된다.
    #: 오래 안 보이는 토큰을 정리할 때 기준이 된다.
    last_seen_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)
